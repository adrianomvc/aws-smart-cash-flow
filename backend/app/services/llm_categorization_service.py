"""LLM-based batch categorization — last resort after rules and trgm memory.

Provider is pluggable: set LLM_PROVIDER=gemini (default) and GEMINI_API_KEY.
If no key is configured the service returns empty results gracefully.
"""
from __future__ import annotations

import json
import logging
from decimal import Decimal
from uuid import uuid4

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Category, Transaction, TransactionCategoryAssignment

logger = logging.getLogger(__name__)

_BATCH_SIZE = 40
_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-1.5-flash:generateContent"
)


class LLMCategorizationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def apply_llm_batch(
        self,
        workspace_id: str,
        transaction_ids: set[str] | None = None,
    ) -> int:
        """Categorize uncategorized transactions using LLM. Returns number processed."""
        api_key = getattr(settings, "gemini_api_key", None)
        if not api_key:
            logger.info("LLM categorization skipped: no GEMINI_API_KEY configured")
            return 0

        categories = self.db.scalars(
            select(Category).where(Category.workspace_id == workspace_id)
        ).all()
        if not categories:
            return 0

        uncategorized = self._get_uncategorized(workspace_id, transaction_ids)
        if not uncategorized:
            return 0

        applied = 0
        for i in range(0, len(uncategorized), _BATCH_SIZE):
            batch = uncategorized[i : i + _BATCH_SIZE]
            results = self._call_llm(batch, categories, api_key)
            applied += self._persist_results(workspace_id, batch, results)

        return applied

    def _get_uncategorized(
        self, workspace_id: str, transaction_ids: set[str] | None
    ) -> list[Transaction]:
        from sqlalchemy import outerjoin

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
        api_key: str,
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

Responda com um array JSON com {len(transactions)} objetos, um por transação, na mesma ordem:
[
  {{
    "index": 0,
    "category_id": "<id da categoria>",
    "confidence": 0.9,
    "regex_suggestion": "<regex python simples para identificar este tipo de transação, ou null>"
  }},
  ...
]"""

        try:
            response = httpx.post(
                f"{_GEMINI_URL}?key={api_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"responseMimeType": "application/json"},
                },
                timeout=30,
            )
            response.raise_for_status()
            raw = response.json()
            text = raw["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text)
        except Exception as exc:
            logger.warning("LLM call failed: %s", exc)
            return []

    def _persist_results(
        self,
        workspace_id: str,
        transactions: list[Transaction],
        results: list[dict],
    ) -> int:
        applied = 0
        category_ids = {
            c.id
            for c in self.db.scalars(
                select(Category).where(Category.workspace_id == workspace_id)
            ).all()
        }
        for item in results:
            idx = item.get("index")
            if idx is None or idx >= len(transactions):
                continue
            transaction = transactions[idx]
            cat_id = item.get("category_id")
            if not cat_id or cat_id not in category_ids:
                continue
            confidence = Decimal(str(min(max(float(item.get("confidence", 0.7)), 0), 1)))
            regex_suggestion = item.get("regex_suggestion") or None

            existing = self.db.scalar(
                select(TransactionCategoryAssignment).where(
                    TransactionCategoryAssignment.transaction_id == transaction.id,
                    TransactionCategoryAssignment.workspace_id == workspace_id,
                )
            )
            if existing is not None:
                continue

            reason = "IA Gemini"
            if regex_suggestion:
                reason += f" | regex sugerido: {regex_suggestion}"

            self.db.add(
                TransactionCategoryAssignment(
                    id=str(uuid4()),
                    workspace_id=workspace_id,
                    transaction_id=transaction.id,
                    category_id=cat_id,
                    source="llm",
                    confidence=confidence,
                    reason=reason,
                    review_status="pending",
                )
            )
            applied += 1

        if applied:
            self.db.flush()
        return applied
