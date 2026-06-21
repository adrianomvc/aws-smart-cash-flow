from collections import defaultdict
from datetime import UTC, date, datetime
from decimal import Decimal
from hashlib import sha256
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import and_, asc, case, delete, desc, func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import (
    Category,
    CreditCard,
    CreditCardStatement,
    ImportJob,
    SourceFile,
    Transaction,
    TransactionCategoryAssignment,
)
from app.db.session import get_db
from app.services.import_service import ImportService
from app.services.merchant_aliases import apply_aliases, load_aliases
from app.services.parsers import (
    extract_installment,
    extract_installment_marker,
    normalize_transaction_description,
)
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
    payment_date: date | None = None
    # Invoice (statement) this credit-card transaction belongs to, when known.
    invoice_closing_date: date | None = None
    invoice_due_date: date | None = None
    invoice_month: date | None = None
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
    # Aggregates over the FULL filtered set (not just the current page).
    total_income: Decimal = Decimal("0")
    total_expense: Decimal = Decimal("0")
    total_net: Decimal = Decimal("0")


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


class UncategorizedGroup(BaseModel):
    key: str
    sample_description: str
    count: int
    total: Decimal
    ids: list[str]


class UncategorizedGroupsResponse(BaseModel):
    workspace_id: str
    groups: list[UncategorizedGroup]
    total_groups: int


@router.get("/uncategorized-groups")
async def uncategorized_groups(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sort_by: str = Query(default="count"),
    sort_dir: str = Query(default="desc"),
    q: str | None = None,
    amount_min: float | None = None,
    amount_max: float | None = None,
) -> UncategorizedGroupsResponse:
    """Group still-uncategorized debit transactions by their normalized description
    (merchant), so the user can categorize a whole merchant at once."""
    categorized = select(TransactionCategoryAssignment.transaction_id).where(
        TransactionCategoryAssignment.workspace_id == auth.workspace_id,
        TransactionCategoryAssignment.category_id.is_not(None),
    )
    group_filters = [
        Transaction.workspace_id == auth.workspace_id,
        Transaction.natural_dedupe_key.is_not(None),
        Transaction.direction == "debit",
        Transaction.id.not_in(categorized),
    ]
    if q:
        search = f"%{q.casefold()}%"
        group_filters.append(
            or_(Transaction.description.ilike(search), Transaction.raw_description.ilike(search))
        )
    if amount_min is not None:
        group_filters.append(func.abs(Transaction.amount) >= amount_min)
    if amount_max is not None:
        group_filters.append(func.abs(Transaction.amount) <= amount_max)
    rows = db.execute(
        select(Transaction.id, Transaction.description, Transaction.amount).where(*group_filters)
    ).all()
    grouped: dict[str, dict[str, object]] = {}
    for tx_id, description, amount in rows:
        entry = grouped.setdefault(
            description,
            {
                "key": description,
                "sample_description": description,
                "count": 0,
                "total": Decimal("0"),
                "ids": [],
            },
        )
        entry["count"] = int(entry["count"]) + 1
        entry["total"] = Decimal(entry["total"]) + abs(amount)
        if len(entry["ids"]) < 500:
            entry["ids"].append(tx_id)
    reverse = sort_dir != "asc"
    if sort_by == "name":
        groups = sorted(
            grouped.values(),
            key=lambda g: str(g["sample_description"]).lower(),
            reverse=reverse,
        )
    elif sort_by == "total":
        groups = sorted(grouped.values(), key=lambda g: Decimal(g["total"]), reverse=reverse)
    else:  # count
        groups = sorted(grouped.values(), key=lambda g: int(g["count"]), reverse=reverse)
    return UncategorizedGroupsResponse(
        workspace_id=auth.workspace_id,
        groups=[UncategorizedGroup(**g) for g in groups[offset:offset + limit]],
        total_groups=len(groups),
    )


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
    # Which date the [date_from, date_to] range applies to: "fatura" (invoice/payment
    # date, default — matches the dashboard) or "compra" (purchase date).
    date_field: str = "fatura",
    # Filter credit-card transactions by the PAYMENT (due) month of the invoice they
    # belong to — i.e. when the invoice is paid — via the linked statement's due_date.
    due_from: date | None = None,
    due_to: date | None = None,
    category_ids: list[str] | None = Query(default=None),  # noqa: B008
    import_job_id: str | None = None,
    source_file_id: str | None = None,
    credit_card_id: str | None = None,
    card_brand: str | None = None,
    ids: str | None = None,
    source_type: str | None = None,
    direction: str | None = None,
    weekday: int | None = Query(default=None, ge=0, le=6),
    q: str | None = None,
    sort_by: str = Query(default="transaction_date"),
    sort_dir: str = Query(default="desc"),
    amount_min: float | None = None,
    amount_max: float | None = None,
    tx_status: str | None = Query(default=None, alias="status"),
    category_source: str | None = None,
    category_review_status: str | None = None,
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
    # The date range can be applied to the purchase date ("compra", default) or to
    # the invoice/payment date ("fatura"). For non-card rows both are the same.
    if date_field == "fatura":
        date_expr = func.coalesce(Transaction.payment_date, Transaction.transaction_date)
    else:
        date_expr = Transaction.transaction_date
    if date_from is not None:
        filters.append(date_expr >= date_from)
    if date_to is not None:
        filters.append(date_expr <= date_to)
    if import_job_id is not None:
        filters.append(Transaction.import_job_id == import_job_id)
    if source_file_id is not None:
        filters.append(Transaction.source_file_id == source_file_id)
    if credit_card_id is not None:
        # Attribute transactions to a card via the statement that imported their file.
        filters.append(
            Transaction.source_file_id.in_(
                select(CreditCardStatement.source_file_id).where(
                    CreditCardStatement.workspace_id == auth.workspace_id,
                    CreditCardStatement.credit_card_id == credit_card_id,
                    CreditCardStatement.source_file_id.is_not(None),
                )
            )
        )
    if card_brand is not None:
        # Transactions of any card with this brand (via the statements' files).
        filters.append(
            Transaction.source_file_id.in_(
                select(CreditCardStatement.source_file_id).where(
                    CreditCardStatement.workspace_id == auth.workspace_id,
                    CreditCardStatement.source_file_id.is_not(None),
                    CreditCardStatement.credit_card_id.in_(
                        select(CreditCard.id).where(
                            CreditCard.workspace_id == auth.workspace_id,
                            CreditCard.brand == card_brand,
                        )
                    ),
                )
            )
        )
    if due_from is not None or due_to is not None:
        # All transactions of an imported statement are paid on that invoice's due
        # date, regardless of each purchase's own date. Filter by the linked
        # statement's due_date so a card month means "the invoice paid that month".
        due_filters = [
            CreditCardStatement.workspace_id == auth.workspace_id,
            CreditCardStatement.source_file_id.is_not(None),
        ]
        if due_from is not None:
            due_filters.append(CreditCardStatement.due_date >= due_from)
        if due_to is not None:
            due_filters.append(CreditCardStatement.due_date <= due_to)
        filters.append(
            Transaction.source_file_id.in_(
                select(CreditCardStatement.source_file_id).where(*due_filters)
            )
        )
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
    if amount_min is not None:
        filters.append(func.abs(Transaction.amount) >= amount_min)
    if amount_max is not None:
        filters.append(func.abs(Transaction.amount) <= amount_max)
    if tx_status == "pending":
        filters.append(
            Transaction.id.not_in(
                select(TransactionCategoryAssignment.transaction_id).where(
                    TransactionCategoryAssignment.workspace_id == auth.workspace_id,
                )
            )
        )
    elif tx_status == "confirmed":
        filters.append(
            Transaction.id.in_(
                select(TransactionCategoryAssignment.transaction_id).where(
                    TransactionCategoryAssignment.workspace_id == auth.workspace_id,
                )
            )
        )
    # Filter by how the transaction was categorized.
    if category_source == "__none__":
        filters.append(
            Transaction.id.not_in(
                select(TransactionCategoryAssignment.transaction_id).where(
                    TransactionCategoryAssignment.workspace_id == auth.workspace_id,
                    TransactionCategoryAssignment.category_id.is_not(None),
                )
            )
        )
    elif category_source in ("manual", "rule", "embedding", "llm"):
        filters.append(
            Transaction.id.in_(
                select(TransactionCategoryAssignment.transaction_id).where(
                    TransactionCategoryAssignment.workspace_id == auth.workspace_id,
                    TransactionCategoryAssignment.source == category_source,
                )
            )
        )
    if category_review_status == "queue":
        # Unified "to review" queue: uncategorized OR a pending machine suggestion.
        filters.append(
            or_(
                Transaction.id.not_in(
                    select(TransactionCategoryAssignment.transaction_id).where(
                        TransactionCategoryAssignment.workspace_id == auth.workspace_id,
                        TransactionCategoryAssignment.category_id.is_not(None),
                    )
                ),
                Transaction.id.in_(
                    select(TransactionCategoryAssignment.transaction_id).where(
                        TransactionCategoryAssignment.workspace_id == auth.workspace_id,
                        TransactionCategoryAssignment.review_status == "pending",
                    )
                ),
            )
        )
    elif category_review_status in ("pending", "accepted"):
        filters.append(
            Transaction.id.in_(
                select(TransactionCategoryAssignment.transaction_id).where(
                    TransactionCategoryAssignment.workspace_id == auth.workspace_id,
                    TransactionCategoryAssignment.review_status == category_review_status,
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
    # Sums over the full filtered set (credit = income, debit = expense; payments
    # are settlements and count as neither). Reuses the same WHERE filters.
    abs_amount = func.abs(Transaction.amount)
    income_sum, expense_sum = db.execute(
        select(
            func.coalesce(
                func.sum(case((Transaction.direction == "credit", abs_amount), else_=0)), 0
            ),
            func.coalesce(
                func.sum(case((Transaction.direction == "debit", abs_amount), else_=0)), 0
            ),
        ).where(*filters)
    ).one()
    income_sum = Decimal(income_sum)
    expense_sum = Decimal(expense_sum)
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
    # Map each page row to the invoice (statement) it belongs to, so the client can
    # show both the transaction date and the invoice it was charged on.
    page_source_file_ids = {
        transaction.source_file_id
        for transaction, _ in rows
        if transaction.source_type == "credit_card_statement" and transaction.source_file_id
    }
    invoice_by_source_file: dict[str, CreditCardStatement] = {}
    if page_source_file_ids:
        for statement in db.scalars(
            select(CreditCardStatement).where(
                CreditCardStatement.workspace_id == auth.workspace_id,
                CreditCardStatement.source_file_id.in_(page_source_file_ids),
            )
        ).all():
            invoice_by_source_file[statement.source_file_id] = statement
    return TransactionListResponse(
        workspace_id=auth.workspace_id,
        items=[
            _transaction_read(
                transaction=transaction,
                assignment=assignment,
                invoice=invoice_by_source_file.get(transaction.source_file_id),
            )
            for transaction, assignment in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
        total_income=income_sum,
        total_expense=expense_sum,
        total_net=income_sum - expense_sum,
    )


@router.get("/export.csv")
async def export_transactions_csv(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> Response:
    """Server-side CSV export. Projects only the 6 columns the CSV needs instead
    of streaming full transaction rows to the client (which previously pulled
    thousands of rows, including heavy fields, from the database)."""
    rows = db.execute(
        select(
            Transaction.transaction_date,
            Transaction.description,
            Transaction.amount,
            Transaction.direction,
            Transaction.account_or_card,
            TransactionCategoryAssignment.category_id,
        )
        .outerjoin(
            TransactionCategoryAssignment,
            and_(
                TransactionCategoryAssignment.transaction_id == Transaction.id,
                TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            ),
        )
        .where(
            Transaction.workspace_id == auth.workspace_id,
            Transaction.natural_dedupe_key.is_not(None),
        )
        .order_by(desc(Transaction.transaction_date), desc(Transaction.id))
    ).all()

    def esc(value: object) -> str:
        return '"' + str(value).replace('"', '""') + '"'

    header = ["Data", "Descricao", "Valor", "Direcao", "Conta", "CategoriaId"]
    lines = [";".join(esc(h) for h in header)]
    for r in rows:
        lines.append(
            ";".join(
                esc(v)
                for v in (
                    r.transaction_date.isoformat(),
                    r.description,
                    r.amount,
                    r.direction,
                    r.account_or_card or "",
                    r.category_id or "",
                )
            )
        )
    body = "﻿" + "\n".join(lines)
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=smartcashflow-transacoes.csv"
        },
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
    aliases = load_aliases(db, auth.workspace_id)
    recalculated_items = []
    for transaction in transactions:
        normalized_description = normalize_transaction_description(
            transaction.raw_description, transaction.transaction_date
        )
        alias_replacement = apply_aliases(
            transaction.raw_description, normalized_description, aliases
        )
        if alias_replacement is not None:
            normalized_description = alias_replacement
        installment_current, installment_total = (
            extract_installment(transaction.raw_description)
            if transaction.source_type == "credit_card_statement"
            else extract_installment_marker(transaction.raw_description)
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
    invoice: CreditCardStatement | None = None,
) -> TransactionRead:
    return TransactionRead(
        id=transaction.id,
        source_file_id=transaction.source_file_id,
        import_job_id=transaction.import_job_id,
        source_type=transaction.source_type,
        source_name=transaction.source_name,
        account_or_card=transaction.account_or_card,
        transaction_date=transaction.transaction_date,
        payment_date=transaction.payment_date,
        invoice_closing_date=invoice.closing_date if invoice else None,
        invoice_due_date=invoice.due_date if invoice else None,
        invoice_month=invoice.statement_month if invoice else None,
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
