from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import Transaction, TransactionCategoryAssignment
from app.db.session import get_db

router = APIRouter(prefix="/transactions", tags=["transactions"])
DbDependency = Depends(get_db)


class CategoryPatch(BaseModel):
    category_id: str


class TransactionRead(BaseModel):
    id: str
    source_file_id: str
    import_job_id: str
    source_type: str
    source_name: str | None
    account_or_card: str | None
    transaction_date: date
    description: str
    raw_description: str
    amount: Decimal
    currency: str
    direction: str
    installment_current: int | None
    installment_total: int | None
    source_line: int | None
    category_id: str | None = None
    category_source: str | None = None
    category_review_status: str | None = None
    created_at: datetime


class TransactionListResponse(BaseModel):
    workspace_id: str
    items: list[TransactionRead]


@router.get("")
async def list_transactions(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    category_id: Annotated[str | None, Query()] = None,
    source_type: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TransactionListResponse:
    assignment_join = and_(
        TransactionCategoryAssignment.transaction_id == Transaction.id,
        TransactionCategoryAssignment.workspace_id == Transaction.workspace_id,
    )
    query = (
        select(Transaction, TransactionCategoryAssignment)
        .outerjoin(TransactionCategoryAssignment, assignment_join)
        .where(Transaction.workspace_id == auth.workspace_id)
        .order_by(desc(Transaction.transaction_date), desc(Transaction.id))
        .limit(limit)
        .offset(offset)
    )

    if date_from is not None:
        query = query.where(Transaction.transaction_date >= date_from)
    if date_to is not None:
        query = query.where(Transaction.transaction_date <= date_to)
    if category_id is not None:
        query = query.where(TransactionCategoryAssignment.category_id == category_id)
    if source_type is not None:
        query = query.where(Transaction.source_type == source_type)
    if q:
        normalized_q = f"%{q.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Transaction.description).like(normalized_q),
                func.lower(Transaction.raw_description).like(normalized_q),
            )
        )

    items = [
        _transaction_read(transaction=transaction, assignment=assignment)
        for transaction, assignment in db.execute(query).all()
    ]
    return TransactionListResponse(workspace_id=auth.workspace_id, items=items)


@router.patch("/{transaction_id}/category")
async def update_transaction_category(
    transaction_id: str,
    payload: CategoryPatch,
    auth: AuthContext = AuthDependency,
) -> dict[str, object]:
    return {
        "workspace_id": auth.workspace_id,
        "transaction_id": transaction_id,
        "category_id": payload.category_id,
    }


def _transaction_read(
    transaction: Transaction,
    assignment: TransactionCategoryAssignment | None,
) -> TransactionRead:
    return TransactionRead(
        id=transaction.id,
        source_file_id=transaction.source_file_id,
        import_job_id=transaction.import_job_id,
        source_type=transaction.source_type,
        source_name=transaction.source_name,
        account_or_card=transaction.account_or_card,
        transaction_date=transaction.transaction_date,
        description=transaction.description,
        raw_description=transaction.raw_description,
        amount=transaction.amount,
        currency=transaction.currency,
        direction=transaction.direction,
        installment_current=transaction.installment_current,
        installment_total=transaction.installment_total,
        source_line=transaction.source_line,
        category_id=assignment.category_id if assignment is not None else None,
        category_source=assignment.source if assignment is not None else None,
        category_review_status=assignment.review_status if assignment is not None else None,
        created_at=transaction.created_at,
    )
