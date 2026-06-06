import re
from decimal import Decimal
from unicodedata import normalize as unicode_normalize
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db.models import CategorizationRule, Transaction, TransactionCategoryAssignment
from app.services.parsers import normalize_transaction_description

_TRGM_THRESHOLD = 0.45  # minimum trigram similarity to accept a suggestion


class CategorizationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def apply_rules(self, workspace_id: str, transaction_ids: set[str] | None = None) -> int:
        rules = self.db.scalars(
            select(CategorizationRule)
            .where(
                CategorizationRule.workspace_id == workspace_id,
                CategorizationRule.active.is_(True),
            )
            .order_by(
                CategorizationRule.priority,
                CategorizationRule.created_at,
                CategorizationRule.id,
            )
        ).all()
        if not rules:
            return 0

        applied = 0
        transaction_query = select(Transaction).where(Transaction.workspace_id == workspace_id)
        if transaction_ids is not None:
            if not transaction_ids:
                return 0
            transaction_query = transaction_query.where(Transaction.id.in_(transaction_ids))
        transactions = self.db.scalars(transaction_query).all()
        if not transactions:
            return 0

        existing_assignments = {
            assignment.transaction_id: assignment
            for assignment in self.db.scalars(
                select(TransactionCategoryAssignment).where(
                    TransactionCategoryAssignment.workspace_id == workspace_id,
                    TransactionCategoryAssignment.transaction_id.in_(
                        [transaction.id for transaction in transactions]
                    ),
                )
            ).all()
        }
        for transaction in transactions:
            existing = existing_assignments.get(transaction.id)

            matching_rule = next(
                (rule for rule in rules if self._matches(rule=rule, transaction=transaction)),
                None,
            )
            if matching_rule is None:
                continue

            changed = False
            if (
                matching_rule.target_direction is not None
                and transaction.direction != matching_rule.target_direction
            ):
                transaction.direction = matching_rule.target_direction
                changed = True

            if matching_rule.category_id is None:
                if changed:
                    applied += 1
                continue

            if existing is not None and existing.source == "manual":
                if changed:
                    applied += 1
                continue

            if existing is None:
                self.db.add(
                    TransactionCategoryAssignment(
                        id=str(uuid4()),
                        workspace_id=workspace_id,
                        transaction_id=transaction.id,
                        category_id=matching_rule.category_id,
                        source="rule",
                        confidence=Decimal("1.0"),
                        reason=f"Regra: {matching_rule.name}",
                        review_status="accepted",
                        rule_id=matching_rule.id,
                    )
                )
                changed = True
            else:
                if existing.category_id != matching_rule.category_id:
                    existing.category_id = matching_rule.category_id
                    existing.source = "rule"
                    existing.confidence = Decimal("1.0")
                    existing.reason = f"Regra: {matching_rule.name}"
                    existing.review_status = "accepted"
                    existing.rule_id = matching_rule.id
                    changed = True
            if changed:
                applied += 1

        self.db.flush()
        return applied

    def _matches(self, rule: CategorizationRule, transaction: Transaction) -> bool:
        raw_value = getattr(transaction, rule.field) or ""
        value = self._normalize_for_match(str(raw_value), field=rule.field)
        pattern = self._normalize_pattern(rule.pattern)

        if rule.match_type == "contains":
            return pattern in value
        if rule.match_type == "starts_with":
            return value.startswith(pattern)
        if rule.match_type == "equals":
            return value == pattern
        if rule.match_type == "regex":
            try:
                return bool(re.search(pattern, value))
            except re.error:
                return False
        if rule.match_type == "amount_recurring":
            return self._matches_amount_recurring(rule, transaction)
        return False

    def _normalize_for_match(self, value: str, field: str) -> str:
        if field == "raw_description":
            return normalize_transaction_description(value).casefold()
        # description is already normalized (uppercase); just casefold + strip accents
        ascii_val = "".join(
            c for c in unicode_normalize("NFKD", value)
            if c.encode("ascii", "ignore") != b""
        )
        return " ".join(ascii_val.casefold().split())

    def _normalize_pattern(self, pattern: str) -> str:
        ascii_val = "".join(
            c for c in unicode_normalize("NFKD", pattern)
            if c.encode("ascii", "ignore") != b""
        )
        return " ".join(ascii_val.casefold().split())

    def apply_trgm_memory(
        self,
        workspace_id: str,
        transaction_ids: set[str] | None = None,
        threshold: float = _TRGM_THRESHOLD,
    ) -> int:
        """Stage 2a: suggest categories based on trigram similarity to already-categorized transactions."""
        transaction_query = (
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
            transaction_query = transaction_query.where(Transaction.id.in_(transaction_ids))
        uncategorized = self.db.scalars(transaction_query).all()
        if not uncategorized:
            return 0

        applied = 0
        for transaction in uncategorized:
            desc = transaction.description or ""
            if not desc:
                continue
            row = self.db.execute(
                text("""
                    SELECT a.category_id, similarity(t.description, :desc) AS sim
                    FROM transactions t
                    JOIN transaction_category_assignments a
                      ON a.transaction_id = t.id AND a.workspace_id = t.workspace_id
                    WHERE t.workspace_id = :workspace_id
                      AND t.description != :desc
                      AND similarity(t.description, :desc) >= :threshold
                    ORDER BY sim DESC
                    LIMIT 1
                """),
                {"workspace_id": workspace_id, "desc": desc, "threshold": threshold},
            ).first()
            if row is None:
                continue
            self.db.add(
                TransactionCategoryAssignment(
                    id=str(uuid4()),
                    workspace_id=workspace_id,
                    transaction_id=transaction.id,
                    category_id=row.category_id,
                    source="embedding",
                    confidence=Decimal(str(round(row.sim, 4))),
                    reason=f"Similaridade de texto ({row.sim:.0%})",
                    review_status="pending",
                )
            )
            applied += 1

        if applied:
            self.db.flush()
        return applied

    def _matches_amount_recurring(self, rule: CategorizationRule, transaction: Transaction) -> bool:
        if rule.amount_ref is None:
            return False
        tolerance = rule.amount_tolerance or Decimal("0.01")
        amount_ok = abs(transaction.amount - rule.amount_ref) <= tolerance
        if not amount_ok:
            return False
        if rule.day_min is not None and transaction.transaction_date.day < rule.day_min:
            return False
        if rule.day_max is not None and transaction.transaction_date.day > rule.day_max:
            return False
        if rule.direction_filter and transaction.direction != rule.direction_filter:
            return False
        return True
