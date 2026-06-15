"""Auto-associate imported credit-card statement files to a card.

The statement (invoice) file is usually imported before the bank payment that
settles it, so association can't happen at import time alone. This runs after
any import (and on demand): for each unassociated credit-card file it looks for
a bank payment whose value matches the invoice total and whose description names
the card (token match), then creates the linking CreditCardStatement.
"""

import re
from calendar import monthrange
from datetime import date
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import CreditCard, CreditCardStatement, SourceFile, Transaction


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    index = year * 12 + (month - 1) + delta
    return index // 12, index % 12 + 1


def _card_due_date(card: CreditCard, transaction_date: date) -> date:
    year, month = transaction_date.year, transaction_date.month
    if transaction_date.day > card.closing_day or card.due_day <= card.closing_day:
        year, month = _shift_month(year, month, 1)
    last_day = monthrange(year, month)[1]
    return date(year, month, min(card.due_day, last_day))


def _card_closing_date(card: CreditCard, due_date: date) -> date:
    year, month = due_date.year, due_date.month
    if card.due_day <= card.closing_day:
        year, month = _shift_month(year, month, -1)
    last_day = monthrange(year, month)[1]
    return date(year, month, min(card.closing_day, last_day))


def _tokens(text: str | None) -> set[str]:
    return {t for t in re.findall(r"[A-Za-zÀ-ú]{4,}", (text or "").upper())}


def _card_matches_description(card: CreditCard, description: str | None) -> bool:
    desc = (description or "").upper()
    for token in _tokens(card.name) | _tokens(card.brand):
        probe = token[:6]  # prefix match handles "INFINIT" vs "INFINITE"
        if probe and probe in desc:
            return True
    return False


def auto_associate_statements(db: Session, workspace_id: str) -> int:
    """Associate unlinked credit-card files to cards. Returns how many were linked."""
    cards = list(
        db.scalars(select(CreditCard).where(CreditCard.workspace_id == workspace_id)).all()
    )
    if not cards:
        return 0

    associated = set(
        db.scalars(
            select(CreditCardStatement.source_file_id).where(
                CreditCardStatement.workspace_id == workspace_id,
                CreditCardStatement.source_file_id.is_not(None),
            )
        ).all()
    )
    files = db.scalars(
        select(SourceFile).where(
            SourceFile.workspace_id == workspace_id,
            SourceFile.source_kind == "credit_card_csv",
        )
    ).all()
    payments = list(
        db.scalars(
            select(Transaction).where(
                Transaction.workspace_id == workspace_id,
                Transaction.direction == "payment",
                Transaction.source_type == "bank_statement",
            )
        ).all()
    )

    linked = 0
    for source_file in files:
        if source_file.id in associated:
            continue
        total = db.scalar(
            select(func.sum(Transaction.amount)).where(
                Transaction.source_file_id == source_file.id,
                Transaction.workspace_id == workspace_id,
                Transaction.source_type == "credit_card_statement",
                Transaction.direction.in_(("debit", "credit")),
            )
        )
        if total is None:
            continue
        total = abs(total)
        if total <= 0:
            continue
        tolerance = max(Decimal("5.00"), total * Decimal("0.03"))

        matched_card: CreditCard | None = None
        for payment in payments:
            if abs(abs(payment.amount) - total) > tolerance:
                continue
            card = next(
                (c for c in cards if _card_matches_description(c, payment.description)), None
            )
            if card is not None:
                matched_card = card
                break
        if matched_card is None:
            continue

        last_tx = db.scalar(
            select(func.max(Transaction.transaction_date)).where(
                Transaction.source_file_id == source_file.id,
                Transaction.workspace_id == workspace_id,
                Transaction.source_type == "credit_card_statement",
            )
        )
        if last_tx is None:
            continue
        due_date = _card_due_date(matched_card, last_tx)
        closing_date = _card_closing_date(matched_card, due_date)

        existing = db.scalar(
            select(CreditCardStatement).where(
                CreditCardStatement.workspace_id == workspace_id,
                CreditCardStatement.credit_card_id == matched_card.id,
                CreditCardStatement.due_date == due_date,
            )
        )
        if existing is not None:
            existing.source_file_id = source_file.id
            if existing.total_amount is None:
                existing.total_amount = total
        else:
            db.add(
                CreditCardStatement(
                    id=str(uuid4()),
                    workspace_id=workspace_id,
                    credit_card_id=matched_card.id,
                    source_file_id=source_file.id,
                    statement_month=date(due_date.year, due_date.month, 1),
                    closing_date=closing_date,
                    due_date=due_date,
                    total_amount=total,
                    status="closed",
                )
            )
        associated.add(source_file.id)
        linked += 1

    if linked:
        db.commit()
    return linked
