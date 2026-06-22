"""LLM-based batch categorization — last resort after rules and trgm memory.

Provider is pluggable: set LLM_PROVIDER=gemini (default) and GEMINI_API_KEY.
If no key is configured the service returns empty results gracefully.
"""
from __future__ import annotations

import json
import logging
from collections import defaultdict
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    Category,
    LlmCategorizationCache,
    Transaction,
    TransactionCategoryAssignment,
)
from app.services.llm_client import chat, llm_available

logger = logging.getLogger(__name__)

_BATCH_SIZE = 40
# Tier de auto-aplicação da IA: só aceita sozinho com alta confiança; o resto
# vira sugestão para revisão do usuário.
_LLM_AUTO_CONFIDENCE = 0.9


def _parse_results(text: str) -> list[dict]:
    """Parses the model's JSON output, accepting either a bare array or an object
    wrapping a list (e.g. {"results": [...]})."""
    data = json.loads(text)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for value in data.values():
            if isinstance(value, list):
                return value
    return []


class LLMCategorizationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def apply_llm_batch(
        self,
        workspace_id: str,
        transaction_ids: set[str] | None = None,
    ) -> int:
        """Categorize uncategorized transactions. Cache hits (descriptions the LLM
        already classified) are applied for free; only genuinely new descriptions
        call the LLM, and only when a GEMINI_API_KEY is configured."""
        categories = self.db.scalars(
            select(Category).where(Category.workspace_id == workspace_id)
        ).all()
        if not categories:
            return 0

        uncategorized = self._get_uncategorized(workspace_id, transaction_ids)
        if not uncategorized:
            return 0

        category_ids = {c.id for c in categories}

        # Group by normalized description so the LLM is consulted at most once per
        # unique description; the answer is applied to every transaction sharing
        # it and cached for future runs.
        groups: dict[str, list[Transaction]] = defaultdict(list)
        for transaction in uncategorized:
            groups[self._key(transaction.description)].append(transaction)

        cache = {
            row.description_key: row
            for row in self.db.scalars(
                select(LlmCategorizationCache).where(
                    LlmCategorizationCache.workspace_id == workspace_id
                )
            ).all()
        }

        applied = 0
        pending_keys: list[str] = []
        for key, transactions in groups.items():
            cached = cache.get(key)
            if cached is not None and cached.category_id in category_ids:
                conf = float(cached.confidence) if cached.confidence is not None else 0.7
                for transaction in transactions:
                    applied += self._assign(
                        workspace_id, transaction, cached.category_id, conf,
                        cached.regex_suggestion, from_cache=True,
                    )
            else:
                pending_keys.append(key)

        # One representative transaction per new description goes to the LLM —
        # only if a provider key is configured.
        if not llm_available():
            if pending_keys:
                logger.info(
                    "LLM skipped for %d new description(s): no LLM provider key configured",
                    len(pending_keys),
                )
            if applied:
                self.db.flush()
            return applied
        reps = [groups[key][0] for key in pending_keys]
        for i in range(0, len(reps), _BATCH_SIZE):
            batch = reps[i : i + _BATCH_SIZE]
            results = self._call_llm(batch, categories)
            for item in results:
                idx = item.get("index")
                if idx is None or idx >= len(batch):
                    continue
                cat_id = item.get("category_id")
                if not cat_id or cat_id not in category_ids:
                    continue
                conf = min(max(float(item.get("confidence", 0.7)), 0), 1)
                regex = item.get("regex_suggestion") or None
                key = self._key(batch[idx].description)
                self._upsert_cache(workspace_id, key, cat_id, conf, regex)
                for transaction in groups[key]:
                    applied += self._assign(
                        workspace_id, transaction, cat_id, conf, regex, from_cache=False
                    )

        if applied:
            self.db.flush()
        return applied

    @staticmethod
    def _key(description: str | None) -> str:
        return (description or "").strip().casefold()

    def _assign(
        self,
        workspace_id: str,
        transaction: Transaction,
        category_id: str,
        confidence_value: float,
        regex: str | None,
        from_cache: bool,
    ) -> int:
        existing = self.db.scalar(
            select(TransactionCategoryAssignment).where(
                TransactionCategoryAssignment.transaction_id == transaction.id,
                TransactionCategoryAssignment.workspace_id == workspace_id,
            )
        )
        if existing is not None:
            return 0
        confidence = Decimal(str(round(min(max(confidence_value, 0), 1), 4)))
        auto = confidence_value >= _LLM_AUTO_CONFIDENCE
        reason = "IA Gemini" + (" (cache)" if from_cache else "")
        if regex:
            reason += f" | regex sugerido: {regex}"
        self.db.add(
            TransactionCategoryAssignment(
                id=str(uuid4()),
                workspace_id=workspace_id,
                transaction_id=transaction.id,
                category_id=category_id,
                source="llm",
                confidence=confidence,
                reason=reason + ("" if auto else " — revisar"),
                review_status="accepted" if auto else "pending",
            )
        )
        return 1

    def _upsert_cache(
        self,
        workspace_id: str,
        key: str,
        category_id: str,
        confidence_value: float,
        regex: str | None,
    ) -> None:
        if not key:
            return
        confidence = Decimal(str(round(min(max(confidence_value, 0), 1), 4)))
        existing = self.db.scalar(
            select(LlmCategorizationCache).where(
                LlmCategorizationCache.workspace_id == workspace_id,
                LlmCategorizationCache.description_key == key,
            )
        )
        if existing is not None:
            existing.category_id = category_id
            existing.confidence = confidence
            existing.regex_suggestion = regex
        else:
            self.db.add(
                LlmCategorizationCache(
                    id=str(uuid4()),
                    workspace_id=workspace_id,
                    description_key=key,
                    category_id=category_id,
                    confidence=confidence,
                    regex_suggestion=regex,
                )
            )

    def _get_uncategorized(
        self, workspace_id: str, transaction_ids: set[str] | None
    ) -> list[Transaction]:
        q = (
            select(Transaction)
            .outerjoin(
                TransactionCategoryAssignment,
                (TransactionCategoryAssignment.transaction_id == Transaction.id)
                & (TransactionCategoryAssignment.workspace_id == workspace_id),
            )
            .where(
                Transaction.workspace_id == workspace_id,
                TransactionCategoryAssignment.id.is_(None),
            )
        )
        if transaction_ids:
            q = q.where(Transaction.id.in_(transaction_ids))
        return list(self.db.scalars(q).all())

    def _call_llm(
        self,
        transactions: list[Transaction],
        categories: list[Category],
    ) -> list[dict]:
        category_list = "\n".join(
            f'- id:{c.id} name:"{c.name}"'
            + (f' (subcategoria de {c.parent_category_id})' if c.parent_category_id else "")
            for c in categories
        )
        items = "\n".join(
            f'{i}. desc:"{t.description}" valor:{t.amount} dir:{t.direction}'
            for i, t in enumerate(transactions)
        )
        prompt = f"""Você é um assistente de finanças pessoais brasileiro.
Classifique cada transação abaixo em uma das categorias disponíveis.
Responda APENAS com JSON válido, sem markdown, sem explicação.

CATEGORIAS:
{category_list}

TRANSAÇÕES:
{items}

Responda com um objeto JSON {{"results": [...]}} com {len(transactions)} itens, na mesma ordem:
{{"results": [
  {{
    "index": 0,
    "category_id": "<id da categoria>",
    "confidence": 0.9,
    "regex_suggestion": "<regex python simples para identificar este tipo de transação, ou null>"
  }}
]}}"""

        # Categorization is a background batch (latency doesn't matter) and Gemini's
        # large context handles many descriptions per call → prefer Gemini, fall
        # back to Groq on failure/rate limit.
        text = chat(
            [{"role": "user", "content": prompt}],
            temperature=0,
            json_mode=True,
            timeout=40,
            prefer="gemini",
        )
        if not text:
            return []
        return _parse_results(text)
