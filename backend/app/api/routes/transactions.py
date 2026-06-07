from collections import defaultdict
from datetime import UTC, date, datetime
from decimal import Decimal
from hashlib import sha256
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, asc, delete, desc, func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import (
    Category,
    ImportJob,
    SourceFile,
    Transaction,
    TransactionCategoryAssignment,
)
from app.db.session import get_db
from app.services.import_service import ImportService
from app.services.parsers import extract_installment, normalize_transaction_description
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/transactions", tags=["transactions"])
DbDependency = Depends(get_db)


class CategoryPatch(BaseModel):
    category_id: str | None


class DirectionPatch(BaseModel):
    direction: str


class ManualTransactionCreate(BaseModel):
    transaction_date: date
    description: str
    amount: Decimal
    direction: str
    category_id: str | None = None


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
    natural_dedupe_key: str | None = None
    category: CategoryAssignmentRead | None = None
    category_id: str | None = None
    category_source: str | None = None
    category_review_status: str | None = None


class TransactionListResponse(BaseModel):
    workspace_id: str
    items: list[TransactionRead]
    total: int
    limit: int
    offset: int


class DescriptionNormalizationResponse(BaseModel):
    workspace_id: str
    scanned_count: int
    changed_count: int
    natural_key_changed_count: int = 0
    duplicate_key_conflict_count: int = 0


class DuplicateTransactionRead(BaseModel):
    id: str
    source_file_id: str
    import_job_id: str
    source_filename: str | None
    source_type: str
    transaction_date: date
    description: str
    raw_description: str
    amount: Decimal
    direction: str
    source_line: int | None
    natural_dedupe_key: str | None
    current_natural_dedupe_key: str


class DuplicateTransactionGroup(BaseModel):
    current_natural_dedupe_key: str
    count: int
    items: list[DuplicateTransactionRead]


class DuplicateTransactionListResponse(BaseModel):
    workspace_id: str
    groups: list[DuplicateTransactionGroup]
    total_groups: int
    total_transactions: int
    limit: int
    offset: int


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_manual_transaction(
    payload: ManualTransactionCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> TransactionRead:
    if payload.direction not in {"debit", "credit", "payment"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid direction. Use debit, credit, or payment.",
        )
    description = payload.description.strip()
    if not description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Description is required.",
        )
    if payload.amount <= Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be greater than zero.",
        )

    _, workspace, _ = WorkspaceService(db).get_or_create_current_workspace(auth)
    category: Category | None = None
    if payload.category_id is not None:
        category = db.scalar(
            select(Category).where(
                Category.id == payload.category_id,
                Category.workspace_id == workspace.id,
            )
        )
        if category is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    amount = payload.amount.quantize(Decimal("0.01"))
    import_service = ImportService(db)
    natural_key = import_service._natural_transaction_dedupe_key(
        workspace_id=workspace.id,
        source_type="unknown",
        transaction_date=payload.transaction_date.isoformat(),
        raw_description=description,
        amount=str(amount),
        direction=payload.direction,
    )
    duplicate = db.scalar(
        select(Transaction.id).where(
            Transaction.workspace_id == workspace.id,
            Transaction.natural_dedupe_key == natural_key,
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A transaction with the same date, description, amount, "
                "and direction already exists."
            ),
        )

    now = datetime.now(UTC)
    source_file_id = str(uuid4())
    import_job_id = str(uuid4())
    transaction_id = str(uuid4())
    content_hash = sha256(f"{workspace.id}|manual|{transaction_id}".encode()).hexdigest()
    source_file = SourceFile(
        id=source_file_id,
        workspace_id=workspace.id,
        original_filename="manual-entry",
        content_hash=content_hash,
        mime_type="application/manual",
        size_bytes=0,
        storage_bucket="manual",
        storage_path=f"{workspace.id}/manual/{transaction_id}",
        source_kind="unknown",
        created_by_user_id=auth.user_id,
    )
    import_job = ImportJob(
        id=import_job_id,
        workspace_id=workspace.id,
        source_file_id=source_file_id,
        status="completed",
        started_at=now,
        finished_at=now,
        total_rows=1,
        valid_rows=1,
        error_rows=0,
        duplicate_rows=0,
    )
    transaction = Transaction(
        id=transaction_id,
        workspace_id=workspace.id,
        source_file_id=source_file_id,
        import_job_id=import_job_id,
        raw_transaction_line_id=None,
        source_type="unknown",
        source_name="manual",
        account_or_card=None,
        transaction_date=payload.transaction_date,
        description=normalize_transaction_description(description),
        raw_description=description,
        amount=amount,
        currency="BRL",
        direction=payload.direction,
        installment_current=None,
        installment_total=None,
        source_line=1,
        dedupe_key=import_service._transaction_dedupe_key(
            workspace_id=workspace.id,
            source_file_id=source_file_id,
            source_line=1,
            transaction_date=payload.transaction_date.isoformat(),
            raw_description=description,
            amount=str(amount),
        ),
        natural_dedupe_key=natural_key,
    )
    db.add_all([source_file, import_job, transaction])
    assignment = None
    if category is not None:
        assignment = TransactionCategoryAssignment(
            id=str(uuid4()),
            workspace_id=workspace.id,
            transaction_id=transaction.id,
            category_id=category.id,
            source="manual",
            confidence=Decimal("1.0"),
            reason="Manual assignment",
            review_status="accepted",
        )
        db.add(assignment)

    db.commit()
    db.refresh(transaction)
    if assignment is not None:
        db.refresh(assignment)
    return _transaction_read(transaction=transaction, assignment=assignment)


@router.get("")
async def list_transactions(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
    category_ids: list[str] | None = Query(default=None),
    import_job_id: str | None = None,
    ids: str | None = None,
    source_type: str | None = None,
    direction: str | None = None,
    weekday: int | None = Query(default=None, ge=0, le=6),
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

    transaction_ids = [item.strip() for item in ids.split(",") if item.strip()] if ids else []
    if len(transaction_ids) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many ids. Use at most 100 transaction ids.",
        )
    filters = [Transaction.workspace_id == auth.workspace_id]
    if transaction_ids:
        filters.append(Transaction.id.in_(transaction_ids))
    else:
        filters.append(Transaction.natural_dedupe_key.is_not(None))
    if date_from is not None:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to is not None:
        filters.append(Transaction.transaction_date <= date_to)
    if import_job_id is not None:
        filters.append(Transaction.import_job_id == import_job_id)
    if source_type is not None:
        filters.append(Transaction.source_type == source_type)
    if direction is not None:
        filters.append(Transaction.direction == direction)
    if weekday is not None:
        filters.append(func.extract("dow", Transaction.transaction_date) == (weekday + 1) % 7)
    if q:
        search = f"%{q.casefold()}%"
        filters.append(
            or_(
                Transaction.description.ilike(search),
                Transaction.raw_description.ilike(search),
            )
        )
    if category_ids:
        all_ids: list[str] = []
        for cid in category_ids:
            all_ids.append(cid)
            child_ids = db.scalars(
                select(Category.id).where(
                    Category.workspace_id == auth.workspace_id,
                    Category.parent_category_id == cid,
                )
            ).all()
            all_ids.extend(child_ids)
        filters.append(
            Transaction.id.in_(
                select(TransactionCategoryAssignment.transaction_id).where(
                    TransactionCategoryAssignment.workspace_id == auth.workspace_id,
                    TransactionCategoryAssignment.category_id.in_(all_ids),
                )
            )
        )

    query = (
        select(Transaction, TransactionCategoryAssignment)
        .outerjoin(
            TransactionCategoryAssignment,
            and_(
                TransactionCategoryAssignment.transaction_id == Transaction.id,
                TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            ),
        )
        .where(*filters)
    )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.execute(
        query
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
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/duplicates")
async def list_duplicate_transaction_candidates(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> DuplicateTransactionListResponse:
    import_service = ImportService(db)
    rows = db.execute(
        select(Transaction, SourceFile)
        .join(SourceFile, SourceFile.id == Transaction.source_file_id)
        .where(Transaction.workspace_id == auth.workspace_id)
        .order_by(
            Transaction.transaction_date,
            Transaction.amount,
            Transaction.id,
        )
    ).all()

    grouped: dict[str, list[tuple[Transaction, SourceFile, str]]] = defaultdict(list)
    for transaction, source_file in rows:
        current_key = import_service._natural_transaction_dedupe_key(
            workspace_id=auth.workspace_id,
            source_type=transaction.source_type,
            transaction_date=transaction.transaction_date.isoformat(),
            raw_description=transaction.raw_description,
            amount=import_service._normalize_amount(transaction.amount),
            direction=transaction.direction,
            installment_current=transaction.installment_current,
            installment_total=transaction.installment_total,
        )
        grouped[current_key].append((transaction, source_file, current_key))

    duplicate_groups = [
        (current_key, items)
        for current_key, items in grouped.items()
        if len(items) > 1
        and len({transaction.source_file_id for transaction, _, _ in items}) > 1
    ]
    duplicate_groups.sort(
        key=lambda group: (
            group[1][0][0].transaction_date,
            group[1][0][0].amount,
            group[1][0][0].description,
        ),
        reverse=True,
    )
    paged_groups = duplicate_groups[offset : offset + limit]
    return DuplicateTransactionListResponse(
        workspace_id=auth.workspace_id,
        groups=[
            DuplicateTransactionGroup(
                current_natural_dedupe_key=current_key,
                count=len(items),
                items=[
                    DuplicateTransactionRead(
                        id=transaction.id,
                        source_file_id=transaction.source_file_id,
                        import_job_id=transaction.import_job_id,
                        source_filename=source_file.original_filename,
                        source_type=transaction.source_type,
                        transaction_date=transaction.transaction_date,
                        description=transaction.description,
                        raw_description=transaction.raw_description,
                        amount=transaction.amount,
                        direction=transaction.direction,
                        source_line=transaction.source_line,
                        natural_dedupe_key=transaction.natural_dedupe_key,
                        current_natural_dedupe_key=current_key,
                    )
                    for transaction, source_file, _ in sorted(
                        items,
                        key=lambda item: (
                            item[0].created_at,
                            item[0].source_file_id,
                            item[0].source_line or 0,
                        ),
                    )
                ],
            )
            for current_key, items in paged_groups
        ],
        total_groups=len(duplicate_groups),
        total_transactions=sum(len(items) for _, items in duplicate_groups),
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
    transaction = db.scalar(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.workspace_id == auth.workspace_id,
        )
    )
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    if payload.category_id is None:
        assignment = db.scalar(
            select(TransactionCategoryAssignment).where(
                TransactionCategoryAssignment.transaction_id == transaction.id,
                TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            )
        )
        if assignment is not None:
            db.delete(assignment)
            db.commit()
            db.refresh(transaction)
        return _transaction_read(transaction=transaction, assignment=None)

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


@router.get("/{transaction_id}/rule-suggestion")
async def get_rule_suggestion(
    transaction_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> dict:
    """Return a rule suggestion for a manually-categorized transaction."""
    import re as _re

    transaction = db.scalar(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.workspace_id == auth.workspace_id,
        )
    )
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    desc = transaction.description or ""
    tokens = [t for t in desc.split() if len(t) > 1][:3]
    if not tokens:
        return {"suggestion": None}

    pattern = "^" + r"\s+".join(_re.escape(t.lower()) for t in tokens)
    prefix = " ".join(tokens[:2])
    affected = db.scalar(
        select(func.count(Transaction.id)).where(
            Transaction.workspace_id == auth.workspace_id,
            Transaction.description.ilike(f"{prefix}%"),
        )
    ) or 0

    return {
        "suggestion": {
            "match_type": "regex",
            "field": "description",
            "pattern": pattern,
            "direction_filter": transaction.direction,
            "suggested_name": f"Auto: {prefix}",
            "affected_count": affected,
        }
    }


@router.patch("/{transaction_id}/direction")
async def update_transaction_direction(
    transaction_id: str,
    payload: DirectionPatch,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> TransactionRead:
    if payload.direction not in {"debit", "credit", "payment"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid direction. Use debit, credit, or payment.",
        )
    transaction = db.scalar(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.workspace_id == auth.workspace_id,
        )
    )
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    transaction.direction = payload.direction
    assignment = db.scalar(
        select(TransactionCategoryAssignment).where(
            TransactionCategoryAssignment.transaction_id == transaction.id,
            TransactionCategoryAssignment.workspace_id == auth.workspace_id,
        )
    )
    db.commit()
    db.refresh(transaction)
    if assignment is not None:
        db.refresh(assignment)
    return _transaction_read(transaction=transaction, assignment=assignment)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> None:
    transaction = db.scalar(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.workspace_id == auth.workspace_id,
        )
    )
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    db.execute(
        delete(TransactionCategoryAssignment).where(
            TransactionCategoryAssignment.transaction_id == transaction.id,
            TransactionCategoryAssignment.workspace_id == auth.workspace_id,
        )
    )
    db.delete(transaction)
    db.commit()


@router.post("/normalize-descriptions")
async def normalize_transaction_descriptions(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> DescriptionNormalizationResponse:
    transactions = db.scalars(
        select(Transaction).where(Transaction.workspace_id == auth.workspace_id)
    ).all()
    import_service = ImportService(db)
    recalculated_items = []
    for transaction in transactions:
        normalized_description = normalize_transaction_description(transaction.raw_description)
        installment_current, installment_total = (
            extract_installment(transaction.raw_description)
            if transaction.source_type == "credit_card_statement"
            else (None, None)
        )
        natural_dedupe_key = import_service._natural_transaction_dedupe_key(
            workspace_id=auth.workspace_id,
            source_type=transaction.source_type,
            transaction_date=transaction.transaction_date.isoformat(),
            raw_description=transaction.raw_description,
            amount=import_service._normalize_amount(transaction.amount),
            direction=transaction.direction,
            installment_current=installment_current,
            installment_total=installment_total,
        )
        recalculated_items.append(
            (
                transaction,
                normalized_description,
                installment_current,
                installment_total,
                natural_dedupe_key,
            )
        )

    stable_key_owner = {
        transaction.natural_dedupe_key: transaction.id
        for transaction, _, _, _, natural_dedupe_key in recalculated_items
        if transaction.natural_dedupe_key
        and transaction.natural_dedupe_key == natural_dedupe_key
    }
    proposed_key_owner: dict[str, str] = {}
    accepted_key_updates: dict[str, str] = {}
    duplicate_key_conflict_count = 0
    for transaction, _, _, _, natural_dedupe_key in recalculated_items:
        if transaction.natural_dedupe_key == natural_dedupe_key:
            continue
        owner_id = stable_key_owner.get(natural_dedupe_key) or proposed_key_owner.get(
            natural_dedupe_key
        )
        if owner_id is not None and owner_id != transaction.id:
            duplicate_key_conflict_count += 1
            continue
        proposed_key_owner[natural_dedupe_key] = transaction.id
        accepted_key_updates[transaction.id] = natural_dedupe_key

    changed_count = 0
    for (
        transaction,
        normalized_description,
        installment_current,
        installment_total,
        _natural_dedupe_key,
    ) in recalculated_items:
        key_update_accepted = transaction.id in accepted_key_updates
        if (
            transaction.description != normalized_description
            or transaction.installment_current != installment_current
            or transaction.installment_total != installment_total
            or key_update_accepted
        ):
            transaction.description = normalized_description
            transaction.installment_current = installment_current
            transaction.installment_total = installment_total
            if key_update_accepted:
                transaction.natural_dedupe_key = None
            changed_count += 1

    db.flush()
    for transaction, _, _, _, _natural_dedupe_key in recalculated_items:
        accepted_key = accepted_key_updates.get(transaction.id)
        if accepted_key is not None:
            transaction.natural_dedupe_key = accepted_key

    db.commit()
    return DescriptionNormalizationResponse(
        workspace_id=auth.workspace_id,
        scanned_count=len(transactions),
        changed_count=changed_count,
        natural_key_changed_count=len(accepted_key_updates),
        duplicate_key_conflict_count=duplicate_key_conflict_count,
    )


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
        natural_dedupe_key=transaction.natural_dedupe_key,
        category=CategoryAssignmentRead(
            category_id=assignment.category_id,
            source=assignment.source,
            confidence=assignment.confidence,
            review_status=assignment.review_status,
        )
        if assignment is not None
        else None,
        category_id=assignment.category_id if assignment is not None else None,
        category_source=assignment.source if assignment is not None else None,
        category_review_status=assignment.review_status if assignment is not None else None,
    )
