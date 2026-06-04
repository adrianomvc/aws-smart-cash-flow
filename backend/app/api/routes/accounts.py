from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import AccountBalance, CreditCard, CreditCardStatement
from app.db.session import get_db

router = APIRouter(prefix="/accounts", tags=["accounts"])
DbDependency = Depends(get_db)


class ActiveAccountItem(BaseModel):
    id: str
    kind: str  # "bank" | "credit_card"
    name: str
    # bank accounts
    current_balance: Decimal | None
    balance_date: date | None
    # credit cards
    limit_amount: Decimal | None
    used_amount: Decimal | None
    available_amount: Decimal | None
    issuer: str | None
    brand: str | None
    last_four: str | None
    closing_day: int | None
    due_day: int | None
    active: bool


class ActiveAccountsResponse(BaseModel):
    workspace_id: str
    items: list[ActiveAccountItem]
    total: int


@router.get("/active")
def list_active_accounts(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> ActiveAccountsResponse:
    items: list[ActiveAccountItem] = []

    # --- Bank accounts: latest balance per account_name ---
    latest_date_subq = (
        select(
            AccountBalance.account_name,
            func.max(AccountBalance.balance_date).label("max_date"),
        )
        .where(AccountBalance.workspace_id == auth.workspace_id)
        .group_by(AccountBalance.account_name)
        .subquery()
    )
    bank_rows = db.execute(
        select(AccountBalance).join(
            latest_date_subq,
            (AccountBalance.account_name == latest_date_subq.c.account_name)
            & (AccountBalance.balance_date == latest_date_subq.c.max_date),
        )
        .where(AccountBalance.workspace_id == auth.workspace_id)
        .order_by(AccountBalance.account_name)
    ).scalars().all()

    for row in bank_rows:
        items.append(
            ActiveAccountItem(
                id=row.id,
                kind="bank",
                name=row.account_name,
                current_balance=row.balance_amount,
                balance_date=row.balance_date,
                limit_amount=None,
                used_amount=None,
                available_amount=None,
                issuer=None,
                brand=None,
                last_four=None,
                closing_day=None,
                due_day=None,
                active=True,
            )
        )

    # --- Credit cards: only active ones, with current open/closed statement total ---
    cards = db.scalars(
        select(CreditCard)
        .where(
            CreditCard.workspace_id == auth.workspace_id,
            CreditCard.active.is_(True),
        )
        .order_by(CreditCard.name)
    ).all()

    today = date.today()
    first_of_month = date(today.year, today.month, 1)

    for card in cards:
        # Sum of open/closed statement for the current month as "used"
        used: Decimal | None = db.scalar(
            select(CreditCardStatement.total_amount).where(
                CreditCardStatement.credit_card_id == card.id,
                CreditCardStatement.workspace_id == auth.workspace_id,
                CreditCardStatement.statement_month == first_of_month,
            )
        )
        available: Decimal | None = None
        if card.limit_amount is not None and used is not None:
            available = max(card.limit_amount - used, Decimal("0.00"))
        elif card.limit_amount is not None:
            available = card.limit_amount

        items.append(
            ActiveAccountItem(
                id=card.id,
                kind="credit_card",
                name=card.name,
                current_balance=None,
                balance_date=None,
                limit_amount=card.limit_amount,
                used_amount=used,
                available_amount=available,
                issuer=card.issuer,
                brand=card.brand,
                last_four=card.last_four,
                closing_day=card.closing_day,
                due_day=card.due_day,
                active=card.active,
            )
        )

    return ActiveAccountsResponse(
        workspace_id=auth.workspace_id,
        items=items,
        total=len(items),
    )
