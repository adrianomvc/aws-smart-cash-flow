from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import delete, desc, func, select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import (
    AccountBalance,
    CreditCardStatement,
    ImportError,
    ImportJob,
    RawTransactionLine,
    SourceFile,
    Transaction,
    TransactionCategoryAssignment,
)
from app.db.session import get_db
from app.domain.imports import ImportPreviewResult
from app.services.import_service import ImportService

router = APIRouter(prefix="/imports", tags=["imports"])
UploadFileDependency = File(...)
DbDependency = Depends(get_db)


class SourceFileRead(BaseModel):
    id: str
    original_filename: str
    source_kind: str
    mime_type: str
    size_bytes: int
    storage_bucket: str
    storage_path: str
    received_at: datetime


class ImportJobRead(BaseModel):
    id: str
    source_file_id: str
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    total_rows: int
    valid_rows: int
    error_rows: int
    duplicate_rows: int
    created_at: datetime
    source_file: SourceFileRead | None = None


class ImportErrorRead(BaseModel):
    id: str
    import_job_id: str
    source_line: int | None
    field_name: str | None
    raw_value: str | None
    error_code: str
    message: str
    created_at: datetime


class ImportListResponse(BaseModel):
    workspace_id: str
    items: list[ImportJobRead]
    total: int
    limit: int
    offset: int


class ImportErrorListResponse(BaseModel):
    workspace_id: str
    import_job_id: str
    items: list[ImportErrorRead]
    limit: int = 100
    offset: int = 0
    total: int = 0


@router.post("")
async def create_import(
    auth: AuthContext = AuthDependency,
    file: UploadFile = UploadFileDependency,
    db: Session = DbDependency,
    source_kind: str | None = Form(default=None),
    credit_card_statement_id: str | None = Form(default=None),
) -> dict[str, object]:
    statement: CreditCardStatement | None = None
    if credit_card_statement_id:
        if source_kind not in (None, "auto", "credit_card_csv"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Credit card statement can only be linked to credit card imports",
            )
        statement = _get_credit_card_statement(
            db=db,
            statement_id=credit_card_statement_id,
            workspace_id=auth.workspace_id,
        )

    result = await ImportService(db).process_upload(auth=auth, file=file, source_kind=source_kind)
    if statement is not None:
        statement.source_file_id = result.source_file_id
        db.add(statement)
        db.commit()
    return result.model_dump()


@router.post("/preview")
async def preview_import(
    auth: AuthContext = AuthDependency,
    file: UploadFile = UploadFileDependency,
    db: Session = DbDependency,
    source_kind: str | None = Form(default=None),
) -> ImportPreviewResult:
    return await ImportService(db).preview_upload(auth=auth, file=file, source_kind=source_kind)


@router.get("")
async def list_imports(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    has_errors: bool = False,
    q: str | None = None,
    source_kind: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ImportListResponse:
    filters = [ImportJob.workspace_id == auth.workspace_id]
    if status_filter:
        filters.append(ImportJob.status == status_filter)
    if has_errors:
        filters.append(ImportJob.error_rows > 0)
    if q:
        filters.append(SourceFile.original_filename.ilike(f"%{q}%"))
    if source_kind:
        allowed_source_kinds = {
            "bank_statement_txt",
            "bank_statement_excel",
            "credit_card_csv",
            "unknown",
        }
        if source_kind not in allowed_source_kinds:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Invalid source_kind. Use bank_statement_txt, bank_statement_excel, "
                    "credit_card_csv, or unknown."
                ),
            )
        filters.append(SourceFile.source_kind == source_kind)

    total = db.scalar(
        select(func.count())
        .select_from(ImportJob)
        .join(SourceFile, SourceFile.id == ImportJob.source_file_id)
        .where(*filters)
    ) or 0
    query = (
        select(ImportJob, SourceFile)
        .join(SourceFile, SourceFile.id == ImportJob.source_file_id)
        .where(*filters)
        .order_by(desc(ImportJob.created_at), desc(ImportJob.id))
        .limit(limit)
        .offset(offset)
    )

    items = [
        _import_job_read(import_job=import_job, source_file=source_file)
        for import_job, source_file in db.execute(query).all()
    ]
    return ImportListResponse(
        workspace_id=auth.workspace_id,
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{import_job_id}")
async def get_import(
    import_job_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> ImportJobRead:
    row = db.execute(
        select(ImportJob, SourceFile)
        .join(SourceFile, SourceFile.id == ImportJob.source_file_id)
        .where(
            ImportJob.id == import_job_id,
            ImportJob.workspace_id == auth.workspace_id,
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import not found")

    import_job, source_file = row
    return _import_job_read(import_job=import_job, source_file=source_file)


@router.delete("/{import_job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_import(
    import_job_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> None:
    import_job = db.scalar(
        select(ImportJob).where(
            ImportJob.id == import_job_id,
            ImportJob.workspace_id == auth.workspace_id,
        )
    )
    if import_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import not found")

    transaction_ids = select(Transaction.id).where(
        Transaction.workspace_id == auth.workspace_id,
        Transaction.import_job_id == import_job_id,
    )
    db.execute(
        delete(TransactionCategoryAssignment).where(
            TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            TransactionCategoryAssignment.transaction_id.in_(transaction_ids),
        )
    )
    db.execute(
        delete(Transaction).where(
            Transaction.workspace_id == auth.workspace_id,
            Transaction.import_job_id == import_job_id,
        )
    )
    db.execute(
        delete(AccountBalance).where(
            AccountBalance.workspace_id == auth.workspace_id,
            AccountBalance.import_job_id == import_job_id,
        )
    )
    db.execute(
        delete(ImportError).where(
            ImportError.workspace_id == auth.workspace_id,
            ImportError.import_job_id == import_job_id,
        )
    )
    db.execute(
        delete(RawTransactionLine).where(
            RawTransactionLine.workspace_id == auth.workspace_id,
            RawTransactionLine.import_job_id == import_job_id,
        )
    )
    db.delete(import_job)
    db.commit()


@router.get("/{import_job_id}/errors")
async def list_import_errors(
    import_job_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> ImportErrorListResponse:
    import_job = db.scalar(
        select(ImportJob).where(
            ImportJob.id == import_job_id,
            ImportJob.workspace_id == auth.workspace_id,
        )
    )
    if import_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import not found")

    error_filters = (
        ImportError.import_job_id == import_job_id,
        ImportError.workspace_id == auth.workspace_id,
    )
    total = db.scalar(select(func.count()).select_from(ImportError).where(*error_filters)) or 0
    errors = db.scalars(
        select(ImportError)
        .where(*error_filters)
        .order_by(ImportError.source_line, ImportError.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return ImportErrorListResponse(
        workspace_id=auth.workspace_id,
        import_job_id=import_job_id,
        limit=limit,
        offset=offset,
        total=total,
        items=[
            ImportErrorRead(
                id=error.id,
                import_job_id=error.import_job_id,
                source_line=error.source_line,
                field_name=error.field_name,
                raw_value=error.raw_value,
                error_code=error.error_code,
                message=error.message,
                created_at=error.created_at,
            )
            for error in errors
        ],
    )


def _source_file_read(source_file: SourceFile) -> SourceFileRead:
    return SourceFileRead(
        id=source_file.id,
        original_filename=source_file.original_filename,
        source_kind=source_file.source_kind,
        mime_type=source_file.mime_type,
        size_bytes=source_file.size_bytes,
        storage_bucket=source_file.storage_bucket,
        storage_path=source_file.storage_path,
        received_at=source_file.received_at,
    )


def _import_job_read(import_job: ImportJob, source_file: SourceFile | None) -> ImportJobRead:
    return ImportJobRead(
        id=import_job.id,
        source_file_id=import_job.source_file_id,
        status=import_job.status,
        started_at=import_job.started_at,
        finished_at=import_job.finished_at,
        total_rows=import_job.total_rows,
        valid_rows=import_job.valid_rows,
        error_rows=import_job.error_rows,
        duplicate_rows=import_job.duplicate_rows,
        created_at=import_job.created_at,
        source_file=_source_file_read(source_file) if source_file is not None else None,
    )


def _get_credit_card_statement(
    *,
    db: Session,
    statement_id: str,
    workspace_id: str,
) -> CreditCardStatement:
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
