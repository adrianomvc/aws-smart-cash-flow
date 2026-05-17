from datetime import date, datetime
from decimal import Decimal
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import Category, Transaction, TransactionCategoryAssignment
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
    total: int
    limit: int
    offset: int


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
    base_query = (
        select(Transaction, TransactionCategoryAssignment)
        .outerjoin(TransactionCategoryAssignment, assignment_join)
        .where(Transaction.workspace_id == auth.workspace_id)
    )

    if date_from is not None:
        base_query = base_query.where(Transaction.transaction_date >= date_from)
    if date_to is not None:
        base_query = base_query.where(Transaction.transaction_date <= date_to)
    if category_id is not None:
        base_query = base_query.where(TransactionCategoryAssignment.category_id == category_id)
    if source_type is not None:
        base_query = base_query.where(Transaction.source_type == source_type)
    if q:
        normalized_q = f"%{q.strip().lower()}%"
        base_query = base_query.where(
            or_(
                func.lower(Transaction.description).like(normalized_q),
                func.lower(Transaction.raw_description).like(normalized_q),
            )
        )

    total = db.scalar(select(func.count()).select_from(base_query.subquery())) or 0
    query = base_query.order_by(desc(Transaction.transaction_date), desc(Transaction.id)).limit(
        limit
    ).offset(offset)
    items = [
        _transaction_read(transaction=transaction, assignment=assignment)
        for transaction, assignment in db.execute(query).all()
    ]
    return TransactionListResponse(
        workspace_id=auth.workspace_id,
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch("/{transaction_id}/category")
async def update_transaction_category(
    transaction_id: str,
    payload: CategoryPatch,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> TransactionRead:
    transaction = _get_transaction(
        db=db,
        workspace_id=auth.workspace_id,
        transaction_id=transaction_id,
    )
    _get_category(
        db=db,
        workspace_id=auth.workspace_id,
        category_id=payload.category_id,
    )
    assignment = db.scalar(
        select(TransactionCategoryAssignment).where(
            TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            TransactionCategoryAssignment.transaction_id == transaction.id,
        )
    )
    if assignment is None:
        assignment = TransactionCategoryAssignment(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            transaction_id=transaction.id,
            category_id=payload.category_id,
            source="manual",
            confidence=Decimal("1.0000"),
            reason=None,
            review_status="accepted",
        )
        db.add(assignment)
    else:
        assignment.category_id = payload.category_id
        assignment.source = "manual"
        assignment.confidence = Decimal("1.0000")
        assignment.reason = None
        assignment.review_status = "accepted"

    db.commit()
    db.refresh(transaction)
    db.refresh(assignment)
    return _transaction_read(transaction=transaction, assignment=assignment)


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


def _get_transaction(db: Session, workspace_id: str, transaction_id: str) -> Transaction:
    transaction = db.scalar(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.workspace_id == workspace_id,
        )
    )
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return transaction


def _get_category(db: Session, workspace_id: str, category_id: str) -> Category:
    category = db.scalar(
        select(Category).where(
            Category.id == category_id,
            Category.workspace_id == workspace_id,
        )
    )
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category
