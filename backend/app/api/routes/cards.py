import re
from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.core.config import settings
from app.db.models import CreditCard, CreditCardStatement, SourceFile, Transaction
from app.db.session import get_db

router = APIRouter(tags=["cards"])
DbDependency = Depends(get_db)


class CreditCardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    issuer: str | None = Field(default=None, max_length=120)
    brand: str | None = Field(default=None, max_length=40)
    last_four: str | None = Field(default=None, min_length=4, max_length=4)
    color: str | None = Field(default=None, max_length=32)
    closing_day: int | None = Field(default=None, ge=1, le=31)
    due_day: int | None = Field(default=None, ge=1, le=31)
    limit_amount: Decimal | None = None


class CreditCardUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    issuer: str | None = Field(default=None, max_length=120)
    brand: str | None = Field(default=None, max_length=40)
    last_four: str | None = Field(default=None, min_length=4, max_length=4)
    color: str | None = Field(default=None, max_length=32)
    closing_day: int | None = Field(default=None, ge=1, le=31)
    due_day: int | None = Field(default=None, ge=1, le=31)
    limit_amount: Decimal | None = None
    active: bool | None = None


class CreditCardRead(BaseModel):
    id: str
    workspace_id: str
    name: str
    issuer: str | None
    brand: str | None
    last_four: str | None
    color: str | None
    closing_day: int
    due_day: int
    limit_amount: Decimal | None
    active: bool
    created_at: object


class CreditCardListResponse(BaseModel):
    workspace_id: str
    items: list[CreditCardRead]
    total: int


class CreditCardStatementCreate(BaseModel):
    credit_card_id: str
    statement_month: date
    due_date: date
    closing_date: date | None = None
    total_amount: Decimal | None = None
    status: str = Field(default="open", min_length=1, max_length=16)
    source_file_id: str | None = None
    notes: str | None = Field(default=None, max_length=1000)


class CreditCardStatementSourceFileUpdate(BaseModel):
    source_file_id: str | None = None


class CreditCardStatementRead(BaseModel):
    id: str
    workspace_id: str
    credit_card_id: str
    source_file_id: str | None
    source_file_name: str | None = None
    statement_month: date
    closing_date: date | None
    due_date: date
    total_amount: Decimal | None
    status: str
    notes: str | None
    created_at: object


class CreditCardStatementListResponse(BaseModel):
    workspace_id: str
    items: list[CreditCardStatementRead]
    total: int


@router.get("/credit-cards")
def list_credit_cards(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CreditCardListResponse:
    cards = db.scalars(
        select(CreditCard)
        .where(CreditCard.workspace_id == auth.workspace_id)
        .order_by(CreditCard.active.desc(), CreditCard.name)
    ).all()
    return CreditCardListResponse(
        workspace_id=auth.workspace_id,
        items=[_credit_card_read(card) for card in cards],
        total=len(cards),
    )


@router.post("/credit-cards", status_code=status.HTTP_201_CREATED)
def create_credit_card(
    payload: CreditCardCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CreditCardRead:
    card = CreditCard(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name=_normalize_required_text(payload.name, "Card name is required"),
        issuer=_normalize_optional_text(payload.issuer),
        brand=_normalize_optional_text(payload.brand),
        last_four=_normalize_last_four(payload.last_four),
        color=_normalize_optional_text(payload.color),
        closing_day=payload.closing_day or settings.default_credit_card_closing_day,
        due_day=payload.due_day or settings.default_credit_card_due_day,
        limit_amount=_positive_decimal_or_none(payload.limit_amount, "Card limit must be positive"),
    )
    db.add(card)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Credit card already exists for this workspace",
        ) from exc
    db.refresh(card)
    return _credit_card_read(card)


@router.patch("/credit-cards/{credit_card_id}")
def update_credit_card(
    credit_card_id: str,
    payload: CreditCardUpdate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CreditCardRead:
    card = _get_credit_card(db, auth.workspace_id, credit_card_id)
    if payload.name is not None:
        card.name = _normalize_required_text(payload.name, "Card name is required")
    if payload.issuer is not None:
        card.issuer = _normalize_optional_text(payload.issuer)
    if payload.brand is not None:
        card.brand = _normalize_optional_text(payload.brand)
    if payload.last_four is not None:
        card.last_four = _normalize_last_four(payload.last_four)
    if payload.color is not None:
        card.color = _normalize_optional_text(payload.color)
    if payload.closing_day is not None:
        card.closing_day = payload.closing_day
    if payload.due_day is not None:
        card.due_day = payload.due_day
    if payload.limit_amount is not None:
        card.limit_amount = _positive_decimal_or_none(
            payload.limit_amount,
            "Card limit must be positive",
        )
    if payload.active is not None:
        card.active = payload.active
    db.add(card)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Credit card already exists for this workspace",
        ) from exc
    db.refresh(card)
    return _credit_card_read(card)


@router.get("/credit-card-statements")
def list_credit_card_statements(
    credit_card_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CreditCardStatementListResponse:
    query = select(CreditCardStatement).where(CreditCardStatement.workspace_id == auth.workspace_id)
    if credit_card_id is not None:
        query = query.where(CreditCardStatement.credit_card_id == credit_card_id)
    if date_from is not None:
        query = query.where(CreditCardStatement.due_date >= date_from)
    if date_to is not None:
        query = query.where(CreditCardStatement.due_date <= date_to)
    statements = db.scalars(query.order_by(CreditCardStatement.due_date.desc())).all()
    file_ids = {s.source_file_id for s in statements if s.source_file_id}
    names: dict[str, str] = {}
    if file_ids:
        for source_file in db.scalars(
            select(SourceFile).where(SourceFile.id.in_(file_ids))
        ).all():
            names[source_file.id] = source_file.original_filename
    return CreditCardStatementListResponse(
        workspace_id=auth.workspace_id,
        items=[
            _statement_read(statement, names.get(statement.source_file_id or ""))
            for statement in statements
        ],
        total=len(statements),
    )


@router.post("/credit-card-statements", status_code=status.HTTP_201_CREATED)
def create_credit_card_statement(
    payload: CreditCardStatementCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CreditCardStatementRead:
    card = _get_credit_card(db, auth.workspace_id, payload.credit_card_id)
    statement = CreditCardStatement(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        credit_card_id=card.id,
        source_file_id=_normalize_uuid_or_none(payload.source_file_id, "Invalid source file id"),
        statement_month=date(payload.statement_month.year, payload.statement_month.month, 1),
        closing_date=payload.closing_date,
        due_date=payload.due_date,
        total_amount=_non_negative_decimal_or_none(
            payload.total_amount,
            "Statement total must be non-negative",
        ),
        status=_statement_status(payload.status),
        notes=_normalize_optional_text(payload.notes),
    )
    db.add(statement)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Credit card statement already exists for this due date",
        ) from exc
    db.refresh(statement)
    return _statement_read(statement)


@router.patch("/credit-card-statements/{statement_id}/source-file")
def update_credit_card_statement_source_file(
    statement_id: str,
    payload: CreditCardStatementSourceFileUpdate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CreditCardStatementRead:
    statement = _get_credit_card_statement(db, auth.workspace_id, statement_id)
    if payload.source_file_id is not None:
        source_file = _get_source_file(db, auth.workspace_id, payload.source_file_id)
        statement.source_file_id = source_file.id
    else:
        statement.source_file_id = None
    db.add(statement)
    db.commit()
    db.refresh(statement)
    return _statement_read(statement)


@router.post("/credit-cards/{credit_card_id}/statement-source-files/{source_file_id}")
def associate_credit_card_source_file(
    credit_card_id: str,
    source_file_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CreditCardStatementRead:
    card = _get_credit_card(db, auth.workspace_id, credit_card_id)
    source_file = _get_source_file(db, auth.workspace_id, source_file_id)
    if source_file.source_kind != "credit_card_csv":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only credit card statement imports can be associated to a card",
        )
    due_date = _statement_due_date_for_source_file(db=db, card=card, source_file=source_file)
    closing_date = _card_closing_date_for_due_month(card=card, due_date=due_date)
    total_amount = _statement_total_for_source_file(db=db, source_file=source_file)
    statement = db.scalar(
        select(CreditCardStatement).where(
            CreditCardStatement.credit_card_id == card.id,
            CreditCardStatement.due_date == due_date,
            CreditCardStatement.workspace_id == auth.workspace_id,
        )
    )
    if statement is None:
        statement = CreditCardStatement(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            credit_card_id=card.id,
            source_file_id=source_file.id,
            statement_month=date(due_date.year, due_date.month, 1),
            closing_date=closing_date,
            due_date=due_date,
            total_amount=total_amount,
            status="closed",
        )
    else:
        statement.source_file_id = source_file.id
        statement.closing_date = statement.closing_date or closing_date
        if total_amount is not None:
            statement.total_amount = total_amount
    db.add(statement)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Credit card statement already exists for this due date",
        ) from exc
    db.refresh(statement)
    return _statement_read(statement)


@router.delete(
    "/credit-card-source-files/{source_file_id}/link",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unlink_credit_card_source_file(
    source_file_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> None:
    """Remove the link between an imported file and its card by deleting the
    statement(s) created from that file. Transactions are kept (they reference
    the source file, not the statement)."""
    _validate_uuid(source_file_id, "Invalid source file id")
    statements = list(
        db.scalars(
            select(CreditCardStatement).where(
                CreditCardStatement.workspace_id == auth.workspace_id,
                CreditCardStatement.source_file_id == source_file_id,
            )
        ).all()
    )
    if not statements:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No card link found for this file",
        )
    for statement in statements:
        db.delete(statement)
    db.commit()
    return None


class AutoAssociateResponse(BaseModel):
    linked: int


@router.post("/credit-cards/auto-associate")
def auto_associate_credit_card_files(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> AutoAssociateResponse:
    from app.services.card_association_service import auto_associate_statements

    linked = auto_associate_statements(db, auth.workspace_id)
    return AutoAssociateResponse(linked=linked)


class StatementReportItem(BaseModel):
    statement_id: str
    credit_card_id: str
    card_name: str
    source_file_id: str | None
    source_file_name: str | None
    statement_month: date
    due_date: date
    status: str
    file_total: Decimal | None
    paid_amount: Decimal | None
    paid_date: date | None


class StatementReportResponse(BaseModel):
    workspace_id: str
    items: list[StatementReportItem]


@router.get("/credit-card-statement-report")
def credit_card_statement_report(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> StatementReportResponse:
    statements = db.scalars(
        select(CreditCardStatement)
        .where(CreditCardStatement.workspace_id == auth.workspace_id)
        .order_by(CreditCardStatement.due_date.desc())
    ).all()
    cards = {
        c.id: c
        for c in db.scalars(
            select(CreditCard).where(CreditCard.workspace_id == auth.workspace_id)
        ).all()
    }
    file_ids = {s.source_file_id for s in statements if s.source_file_id}
    files = (
        {
            sf.id: sf
            for sf in db.scalars(select(SourceFile).where(SourceFile.id.in_(file_ids))).all()
        }
        if file_ids
        else {}
    )
    bank_payments = list(
        db.scalars(
            select(Transaction).where(
                Transaction.workspace_id == auth.workspace_id,
                Transaction.direction == "payment",
                Transaction.source_type == "bank_statement",
            )
        ).all()
    )

    items: list[StatementReportItem] = []
    for statement in statements:
        file_total = statement.total_amount
        if file_total is None and statement.source_file_id:
            source_file = files.get(statement.source_file_id)
            if source_file is not None:
                file_total = _statement_total_for_source_file(db=db, source_file=source_file)

        paid_amount: Decimal | None = None
        paid_date: date | None = None
        if file_total is not None and file_total > 0:
            tolerance = max(Decimal("5.00"), file_total * Decimal("0.03"))
            best: tuple[int, Transaction] | None = None
            for payment in bank_payments:
                if abs(abs(payment.amount) - file_total) > tolerance:
                    continue
                delta = abs((payment.transaction_date - statement.due_date).days)
                if delta > 15:
                    continue
                if best is None or delta < best[0]:
                    best = (delta, payment)
            if best is not None:
                paid_amount = abs(best[1].amount)
                paid_date = best[1].transaction_date

        card = cards.get(statement.credit_card_id)
        source_file = files.get(statement.source_file_id) if statement.source_file_id else None
        items.append(
            StatementReportItem(
                statement_id=statement.id,
                credit_card_id=statement.credit_card_id,
                card_name=card.name if card is not None else "Cartão",
                source_file_id=statement.source_file_id,
                source_file_name=source_file.original_filename if source_file is not None else None,
                statement_month=statement.statement_month,
                due_date=statement.due_date,
                status=statement.status,
                file_total=file_total,
                paid_amount=paid_amount,
                paid_date=paid_date,
            )
        )
    return StatementReportResponse(workspace_id=auth.workspace_id, items=items)


class CreditCardSourceFileItem(BaseModel):
    source_file_id: str
    original_filename: str
    received_at: datetime
    total: Decimal | None
    reference_month: str | None  # "YYYY-MM", a maioria (moda) do ano/mês das transações
    linked_credit_card_id: str | None
    linked_card_name: str | None
    # Conciliation data (present when the file is linked to a card statement)
    due_date: date | None = None
    status: str | None = None
    paid_amount: Decimal | None = None
    paid_date: date | None = None


class CreditCardSourceFileResponse(BaseModel):
    workspace_id: str
    items: list[CreditCardSourceFileItem]


@router.get("/credit-card-source-files")
def credit_card_source_files(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CreditCardSourceFileResponse:
    """List imported credit-card CSV files with computed total and the reference
    month (the most frequent year/month among the file's transactions), plus the
    card currently linked to it. Powers manual file→card linking."""
    source_files = list(
        db.scalars(
            select(SourceFile)
            .where(
                SourceFile.workspace_id == auth.workspace_id,
                SourceFile.source_kind == "credit_card_csv",
            )
            .order_by(SourceFile.received_at.desc())
        ).all()
    )
    file_ids = [sf.id for sf in source_files]
    if not file_ids:
        return CreditCardSourceFileResponse(workspace_id=auth.workspace_id, items=[])

    # Totals per file (one grouped query).
    totals: dict[str, Decimal] = {}
    for sfid, total in db.execute(
        select(Transaction.source_file_id, func.sum(Transaction.amount))
        .where(
            Transaction.workspace_id == auth.workspace_id,
            Transaction.source_file_id.in_(file_ids),
            Transaction.source_type == "credit_card_statement",
            Transaction.direction.in_(("debit", "credit")),
        )
        .group_by(Transaction.source_file_id)
    ).all():
        if sfid is not None and total is not None:
            totals[sfid] = max(total, Decimal("0.00"))

    # Reference month = mode of (year, month) over the file's transactions
    # (one grouped query; pick the month with the most transactions per file).
    month_counts: dict[str, list[tuple[date, int]]] = {}
    for sfid, month_start, cnt in db.execute(
        select(
            Transaction.source_file_id,
            func.date_trunc("month", Transaction.transaction_date).label("m"),
            func.count().label("cnt"),
        )
        .where(
            Transaction.workspace_id == auth.workspace_id,
            Transaction.source_file_id.in_(file_ids),
            Transaction.source_type == "credit_card_statement",
        )
        .group_by(Transaction.source_file_id, "m")
    ).all():
        if sfid is not None and month_start is not None:
            month_counts.setdefault(sfid, []).append((month_start, int(cnt)))

    reference_month: dict[str, str] = {}
    for sfid, pairs in month_counts.items():
        # most transactions wins; tie-break on the more recent month
        best_month = max(pairs, key=lambda p: (p[1], p[0]))[0]
        reference_month[sfid] = f"{best_month.year:04d}-{best_month.month:02d}"

    # Current link per file (source_file_id -> card / statement).
    linked_card: dict[str, CreditCard] = {}
    linked_statement: dict[str, CreditCardStatement] = {}
    cards_by_id = {
        c.id: c
        for c in db.scalars(
            select(CreditCard).where(CreditCard.workspace_id == auth.workspace_id)
        ).all()
    }
    for statement in db.scalars(
        select(CreditCardStatement).where(
            CreditCardStatement.workspace_id == auth.workspace_id,
            CreditCardStatement.source_file_id.in_(file_ids),
        )
    ).all():
        if statement.source_file_id and statement.credit_card_id in cards_by_id:
            linked_card[statement.source_file_id] = cards_by_id[statement.credit_card_id]
            linked_statement[statement.source_file_id] = statement

    # Bank payments, for matching the paid amount of each linked statement.
    bank_payments = list(
        db.scalars(
            select(Transaction).where(
                Transaction.workspace_id == auth.workspace_id,
                Transaction.direction == "payment",
                Transaction.source_type == "bank_statement",
            )
        ).all()
    )

    def _matched_payment(due: date, file_total: Decimal | None) -> tuple[Decimal, date] | None:
        if file_total is None or file_total <= 0:
            return None
        tolerance = max(Decimal("5.00"), file_total * Decimal("0.03"))
        best: tuple[int, Transaction] | None = None
        for payment in bank_payments:
            if abs(abs(payment.amount) - file_total) > tolerance:
                continue
            delta = abs((payment.transaction_date - due).days)
            if delta > 15:
                continue
            if best is None or delta < best[0]:
                best = (delta, payment)
        if best is None:
            return None
        return abs(best[1].amount), best[1].transaction_date

    items: list[CreditCardSourceFileItem] = []
    for sf in source_files:
        statement = linked_statement.get(sf.id)
        total = totals.get(sf.id)
        paid_amount: Decimal | None = None
        paid_date: date | None = None
        if statement is not None:
            file_total = statement.total_amount if statement.total_amount is not None else total
            match = _matched_payment(statement.due_date, file_total)
            if match is not None:
                paid_amount, paid_date = match
        items.append(
            CreditCardSourceFileItem(
                source_file_id=sf.id,
                original_filename=sf.original_filename,
                received_at=sf.received_at,
                total=total,
                reference_month=reference_month.get(sf.id),
                linked_credit_card_id=linked_card[sf.id].id if sf.id in linked_card else None,
                linked_card_name=linked_card[sf.id].name if sf.id in linked_card else None,
                due_date=statement.due_date if statement is not None else None,
                status=statement.status if statement is not None else None,
                paid_amount=paid_amount,
                paid_date=paid_date,
            )
        )
    return CreditCardSourceFileResponse(workspace_id=auth.workspace_id, items=items)


def _credit_card_read(card: CreditCard) -> CreditCardRead:
    return CreditCardRead(
        id=card.id,
        workspace_id=card.workspace_id,
        name=card.name,
        issuer=card.issuer,
        brand=card.brand,
        last_four=card.last_four,
        color=card.color,
        closing_day=card.closing_day,
        due_day=card.due_day,
        limit_amount=card.limit_amount,
        active=card.active,
        created_at=card.created_at,
    )


def _statement_read(
    statement: CreditCardStatement, source_file_name: str | None = None
) -> CreditCardStatementRead:
    return CreditCardStatementRead(
        id=statement.id,
        workspace_id=statement.workspace_id,
        credit_card_id=statement.credit_card_id,
        source_file_id=statement.source_file_id,
        source_file_name=source_file_name,
        statement_month=statement.statement_month,
        closing_date=statement.closing_date,
        due_date=statement.due_date,
        total_amount=statement.total_amount,
        status=statement.status,
        notes=statement.notes,
        created_at=statement.created_at,
    )


def _get_credit_card(db: Session, workspace_id: str, credit_card_id: str) -> CreditCard:
    _validate_uuid(credit_card_id, "Invalid credit card id")
    card = db.scalar(
        select(CreditCard).where(
            CreditCard.id == credit_card_id,
            CreditCard.workspace_id == workspace_id,
        )
    )
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit card not found")
    return card


def _get_credit_card_statement(
    db: Session,
    workspace_id: str,
    statement_id: str,
) -> CreditCardStatement:
    _validate_uuid(statement_id, "Invalid credit card statement id")
    statement = db.scalar(
        select(CreditCardStatement).where(
            CreditCardStatement.id == statement_id,
            CreditCardStatement.workspace_id == workspace_id,
        )
    )
    if statement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit card statement not found",
        )
    return statement


def _get_source_file(db: Session, workspace_id: str, source_file_id: str) -> SourceFile:
    _validate_uuid(source_file_id, "Invalid source file id")
    source_file = db.scalar(
        select(SourceFile).where(
            SourceFile.id == source_file_id,
            SourceFile.workspace_id == workspace_id,
        )
    )
    if source_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source file not found")
    return source_file


def _statement_due_date_for_source_file(
    *,
    db: Session,
    card: CreditCard,
    source_file: SourceFile,
) -> date:
    filename_due_date = _infer_statement_due_date_from_filename(source_file.original_filename)
    if filename_due_date is not None:
        return filename_due_date

    last_transaction_date = db.scalar(
        select(func.max(Transaction.transaction_date)).where(
            Transaction.source_file_id == source_file.id,
            Transaction.workspace_id == source_file.workspace_id,
            Transaction.source_type == "credit_card_statement",
        )
    )
    if last_transaction_date is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not infer statement due date from filename or transactions",
        )
    return _card_due_date_for_transaction(card=card, transaction_date=last_transaction_date)


def _statement_total_for_source_file(
    *,
    db: Session,
    source_file: SourceFile,
) -> Decimal | None:
    total = db.scalar(
        select(func.sum(Transaction.amount)).where(
            Transaction.source_file_id == source_file.id,
            Transaction.workspace_id == source_file.workspace_id,
            Transaction.source_type == "credit_card_statement",
            Transaction.direction.in_(("debit", "credit")),
        )
    )
    if total is None:
        return None
    return max(total, Decimal("0.00"))


def _infer_statement_due_date_from_filename(filename: str) -> date | None:
    match = re.search(r"(20\d{2})(0[1-9]|1[0-2])([0-3]\d)", filename)
    if match is None:
        return None
    year, month, day = map(int, match.groups())
    try:
        return date(year, month, day)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid statement due date in filename",
        ) from exc


def _card_closing_date_for_due_month(*, card: CreditCard, due_date: date) -> date:
    year, month = due_date.year, due_date.month
    if card.due_day <= card.closing_day:
        year, month = _shift_month(year=year, month=month, delta=-1)
    last_day = monthrange(year, month)[1]
    return date(year, month, min(card.closing_day, last_day))


def _card_due_date_for_transaction(*, card: CreditCard, transaction_date: date) -> date:
    year, month = transaction_date.year, transaction_date.month
    if transaction_date.day > card.closing_day or card.due_day <= card.closing_day:
        year, month = _shift_month(year=year, month=month, delta=1)
    last_day = monthrange(year, month)[1]
    return date(year, month, min(card.due_day, last_day))


def _shift_month(*, year: int, month: int, delta: int) -> tuple[int, int]:
    month_index = (year * 12) + (month - 1) + delta
    return month_index // 12, (month_index % 12) + 1


def _normalize_required_text(value: str, message: str) -> str:
    text = value.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)
    return text


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def _normalize_last_four(value: str | None) -> str | None:
    text = _normalize_optional_text(value)
    if text is None:
        return None
    if not text.isdigit() or len(text) != 4:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Card last four must contain exactly four digits",
        )
    return text


def _positive_decimal_or_none(value: Decimal | None, message: str) -> Decimal | None:
    if value is None:
        return None
    if value <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)
    return value


def _non_negative_decimal_or_none(value: Decimal | None, message: str) -> Decimal | None:
    if value is None:
        return None
    if value < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)
    return value


def _statement_status(value: str) -> str:
    status_value = value.strip().lower()
    if status_value not in {"open", "closed", "paid", "partial"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid statement status",
        )
    return status_value


def _normalize_uuid_or_none(value: str | None, message: str) -> str | None:
    if value is None:
        return None
    return _validate_uuid(value, message)


def _validate_uuid(value: str, message: str) -> str:
    try:
        UUID(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=message,
        ) from exc
    return value
