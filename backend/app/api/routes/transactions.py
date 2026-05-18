from datetime import date
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, asc, desc, or_, select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import Category, Transaction, TransactionCategoryAssignment
from app.db.session import get_db

router = APIRouter(prefix="/transactions", tags=["transactions"])
DbDependency = Depends(get_db)


class CategoryPatch(BaseModel):
    category_id: str


class CategoryAssignmentRead(BaseModel):
    category_id: str
    source: str
    confidence: Decimal | None
    review_status: str


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
    category: CategoryAssignmentRead | None = None


class TransactionListResponse(BaseModel):
    workspace_id: str
    items: list[TransactionRead]


@router.get("")
async def list_transactions(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
    category_id: str | None = None,
    source_type: str | None = None,
    direction: str | None = None,
    q: str | None = None,
    sort_by: str = Query(default="transaction_date"),
    sort_dir: str = Query(default="desc"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> TransactionListResponse:
    sort_columns = {
        "transaction_date": Transaction.transaction_date,
        "amount": Transaction.amount,
        "description": Transaction.description,
        "direction": Transaction.direction,
        "source_type": Transaction.source_type,
    }
    sort_column = sort_columns.get(sort_by)
    if sort_column is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid sort_by. Use transaction_date, amount, description, "
                "direction, or source_type."
            ),
        )
    if sort_dir not in {"asc", "desc"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid sort_dir. Use asc or desc.",
        )
    sort_expression = asc(sort_column) if sort_dir == "asc" else desc(sort_column)

    filters = [
        Transaction.workspace_id == auth.workspace_id,
        Transaction.natural_dedupe_key.is_not(None),
    ]
    if date_from is not None:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to is not None:
        filters.append(Transaction.transaction_date <= date_to)
    if source_type is not None:
        filters.append(Transaction.source_type == source_type)
    if direction is not None:
        filters.append(Transaction.direction == direction)
    if q:
        search = f"%{q.casefold()}%"
        filters.append(
            or_(
                Transaction.description.ilike(search),
                Transaction.raw_description.ilike(search),
            )
        )
    if category_id is not None:
        filters.append(
            Transaction.id.in_(
                select(TransactionCategoryAssignment.transaction_id).where(
                    TransactionCategoryAssignment.workspace_id == auth.workspace_id,
                    TransactionCategoryAssignment.category_id == category_id,
                )
            )
        )

    rows = db.execute(
        select(Transaction, TransactionCategoryAssignment)
        .outerjoin(
            TransactionCategoryAssignment,
            and_(
                TransactionCategoryAssignment.transaction_id == Transaction.id,
                TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            ),
        )
        .where(*filters)
        .order_by(
            sort_expression,
            desc(Transaction.created_at),
            desc(Transaction.id),
        )
        .limit(limit)
        .offset(offset)
    ).all()
    return TransactionListResponse(
        workspace_id=auth.workspace_id,
        items=[
            _transaction_read(transaction=transaction, assignment=assignment)
            for transaction, assignment in rows
        ],
    )


@router.patch("/{transaction_id}/category")
async def update_transaction_category(
    transaction_id: str,
    payload: CategoryPatch,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> TransactionRead:
    transaction = db.scalar(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.workspace_id == auth.workspace_id,
        )
    )
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    category = db.scalar(
        select(Category).where(
            Category.id == payload.category_id,
            Category.workspace_id == auth.workspace_id,
        )
    )
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    assignment = db.scalar(
        select(TransactionCategoryAssignment).where(
            TransactionCategoryAssignment.transaction_id == transaction.id,
            TransactionCategoryAssignment.workspace_id == auth.workspace_id,
        )
    )
    if assignment is None:
        assignment = TransactionCategoryAssignment(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            transaction_id=transaction.id,
            category_id=category.id,
            source="manual",
            confidence=Decimal("1.0"),
            reason="Manual assignment",
            review_status="accepted",
        )
        db.add(assignment)
    else:
        assignment.category_id = category.id
        assignment.source = "manual"
        assignment.confidence = Decimal("1.0")
        assignment.reason = "Manual assignment"
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
        category=CategoryAssignmentRead(
            category_id=assignment.category_id,
            source=assignment.source,
            confidence=assignment.confidence,
            review_status=assignment.review_status,
        )
        if assignment is not None
        else None,
    )
