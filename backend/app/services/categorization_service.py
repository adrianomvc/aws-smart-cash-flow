from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import CategorizationRule, Transaction, TransactionCategoryAssignment


class CategorizationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def apply_rules(self, workspace_id: str) -> int:
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
        transactions = self.db.scalars(
            select(Transaction).where(Transaction.workspace_id == workspace_id)
        ).all()
        for transaction in transactions:
            existing = self.db.scalar(
                select(TransactionCategoryAssignment).where(
                    TransactionCategoryAssignment.workspace_id == workspace_id,
                    TransactionCategoryAssignment.transaction_id == transaction.id,
                )
            )

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
                        reason=f"Matched rule: {matching_rule.name}",
                        review_status="accepted",
                    )
                )
                changed = True
            else:
                if existing.category_id != matching_rule.category_id:
                    existing.category_id = matching_rule.category_id
                    existing.source = "rule"
                    existing.confidence = Decimal("1.0")
                    existing.reason = f"Matched rule: {matching_rule.name}"
                    existing.review_status = "accepted"
                    changed = True
            if changed:
                applied += 1

        self.db.flush()
        return applied

    def _matches(self, rule: CategorizationRule, transaction: Transaction) -> bool:
        raw_value = getattr(transaction, rule.field) or ""
        value = " ".join(str(raw_value).casefold().split())
        pattern = " ".join(rule.pattern.casefold().split())

        if rule.match_type == "contains":
            return pattern in value
        if rule.match_type == "starts_with":
            return value.startswith(pattern)
        if rule.match_type == "equals":
            return value == pattern
        return False
