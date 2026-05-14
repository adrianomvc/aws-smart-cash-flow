from datetime import UTC, date, datetime
from decimal import Decimal
from hashlib import sha256
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext
from app.db.models import (
    ImportError,
    ImportJob,
    RawTransactionLine,
    SourceFile,
    Transaction,
    User,
    Workspace,
    WorkspaceMember,
)
from app.domain.imports import ImportResult, ImportStatus, ParsedTransaction, SourceKind
from app.services.file_classifier import classify_file
from app.services.parsers import parse_credit_card_csv, parse_txt_bank_statement


class ImportService:
    max_upload_bytes = 2 * 1024 * 1024

    def __init__(self, db: Session) -> None:
        self.db = db

    async def process_upload(self, auth: AuthContext, file: UploadFile) -> ImportResult:
        filename = file.filename or "upload"
        raw_bytes = await file.read()
        return self.import_bytes(
            auth=auth,
            filename=filename,
            mime_type=file.content_type or "application/octet-stream",
            storage_bucket="local",
            storage_path=f"{auth.workspace_id}/local/{filename}",
            content=raw_bytes,
        )

    def import_bytes(
        self,
        auth: AuthContext,
        filename: str,
        mime_type: str,
        storage_bucket: str,
        storage_path: str,
        content: bytes,
    ) -> ImportResult:
        suffix = filename.rsplit(".", maxsplit=1)[-1].lower() if "." in filename else ""
        if suffix not in {"txt", "csv"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only TXT and CSV files are supported in MVP 1",
            )
        if len(content) > self.max_upload_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File exceeds MVP upload limit",
            )

        content_hash = sha256(content).hexdigest()
        try:
            text_content = content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be encoded as UTF-8",
            ) from exc

        source_kind = classify_file(filename, text_content)
        parse_result = self._parse(source_kind, text_content)

        self._ensure_auth_entities(auth)
        existing_source_file = self.db.scalar(
            select(SourceFile).where(
                SourceFile.workspace_id == auth.workspace_id,
                SourceFile.content_hash == content_hash,
            )
        )
        if existing_source_file is not None:
            import_job = self._create_import_job(
                workspace_id=auth.workspace_id,
                source_file_id=existing_source_file.id,
                status_value=ImportStatus.DUPLICATE_FILE,
                total_rows=0,
                valid_rows=0,
                error_rows=0,
            )
            self.db.add(import_job)
            self.db.commit()
            return ImportResult(
                import_job_id=import_job.id,
                source_file_id=existing_source_file.id,
                status=ImportStatus.DUPLICATE_FILE,
                total_rows=0,
                valid_rows=0,
                error_rows=0,
                duplicate_rows=0,
            )

        status_value = (
            ImportStatus.COMPLETED_WITH_ERRORS if parse_result.errors else ImportStatus.COMPLETED
        )
        source_file = SourceFile(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            original_filename=filename,
            content_hash=content_hash,
            mime_type=mime_type,
            size_bytes=len(content),
            storage_bucket=storage_bucket,
            storage_path=storage_path,
            source_kind=source_kind.value,
            created_by_user_id=auth.user_id,
        )
        import_job = self._create_import_job(
            workspace_id=auth.workspace_id,
            source_file_id=source_file.id,
            status_value=status_value,
            total_rows=parse_result.total_rows,
            valid_rows=0,
            error_rows=len(parse_result.errors),
        )
        self.db.add(source_file)
        self.db.add(import_job)
        self.db.flush()

        raw_lines = self._persist_raw_lines(
            auth=auth,
            source_file=source_file,
            import_job=import_job,
            source_kind=source_kind,
            content=text_content,
            valid_lines={transaction.source_line for transaction in parse_result.transactions},
            invalid_lines={error.source_line for error in parse_result.errors if error.source_line},
        )
        persisted_transactions = 0
        duplicate_transactions = 0
        for parsed_transaction in parse_result.transactions:
            transaction = self.persist_transaction(
                workspace_id=auth.workspace_id,
                source_file=source_file,
                import_job=import_job,
                raw_line=raw_lines.get(parsed_transaction.source_line),
                parsed_transaction=parsed_transaction,
            )
            if transaction.import_job_id == import_job.id:
                persisted_transactions += 1
            else:
                duplicate_transactions += 1

        for parse_error in parse_result.errors:
            self.db.add(
                ImportError(
                    id=str(uuid4()),
                    workspace_id=auth.workspace_id,
                    import_job_id=import_job.id,
                    source_line=parse_error.source_line,
                    field_name=parse_error.field_name,
                    raw_value=parse_error.raw_value,
                    error_code=parse_error.error_code,
                    message=parse_error.message,
                )
            )

        import_job.valid_rows = persisted_transactions
        self.db.commit()
        return ImportResult(
            import_job_id=import_job.id,
            source_file_id=source_file.id,
            status=status_value,
            total_rows=parse_result.total_rows,
            valid_rows=persisted_transactions,
            error_rows=len(parse_result.errors),
            duplicate_rows=duplicate_transactions,
        )

    def persist_transaction(
        self,
        workspace_id: str,
        source_file: SourceFile,
        import_job: ImportJob,
        raw_line: RawTransactionLine | None,
        parsed_transaction: ParsedTransaction,
    ) -> Transaction:
        source_type = self._source_type(source_file.source_kind)
        existing_transaction = self._find_existing_transaction(
            workspace_id=workspace_id,
            source_type=source_type,
            transaction_date=parsed_transaction.transaction_date,
            raw_description=parsed_transaction.raw_description,
            amount=parsed_transaction.amount,
            direction=parsed_transaction.direction.value,
        )
        if existing_transaction is not None:
            return existing_transaction

        dedupe_key = self._transaction_dedupe_key(
            workspace_id=workspace_id,
            source_type=source_type,
            transaction_date=parsed_transaction.transaction_date.isoformat(),
            raw_description=parsed_transaction.raw_description,
            amount=str(parsed_transaction.amount),
            direction=parsed_transaction.direction.value,
        )

        transaction = Transaction(
            id=str(uuid4()),
            workspace_id=workspace_id,
            source_file_id=source_file.id,
            import_job_id=import_job.id,
            raw_transaction_line_id=raw_line.id if raw_line is not None else None,
            source_type=source_type,
            source_name=None,
            account_or_card=None,
            transaction_date=parsed_transaction.transaction_date,
            description=parsed_transaction.description,
            raw_description=parsed_transaction.raw_description,
            amount=parsed_transaction.amount,
            currency="BRL",
            direction=parsed_transaction.direction.value,
            installment_current=None,
            installment_total=None,
            source_line=parsed_transaction.source_line,
            dedupe_key=dedupe_key,
        )
        self.db.add(transaction)
        self.db.flush()
        return transaction

    def _parse(self, source_kind: SourceKind, content: str):
        if source_kind == SourceKind.BANK_STATEMENT_TXT:
            return parse_txt_bank_statement(content)
        if source_kind == SourceKind.CREDIT_CARD_CSV:
            return parse_credit_card_csv(content)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported or unrecognized file layout",
        )

    def _ensure_auth_entities(self, auth: AuthContext) -> None:
        if self.db.get(User, auth.user_id) is None:
            self.db.add(
                User(
                    id=auth.user_id,
                    supabase_user_id=auth.user_id,
                    email=f"{auth.user_id}@local.invalid",
                    display_name=None,
                )
            )
        if self.db.get(Workspace, auth.workspace_id) is None:
            self.db.add(Workspace(id=auth.workspace_id, name="Local workspace"))
        membership = self.db.scalar(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == auth.workspace_id,
                WorkspaceMember.user_id == auth.user_id,
            )
        )
        if membership is None:
            self.db.add(
                WorkspaceMember(
                    id=str(uuid4()),
                    workspace_id=auth.workspace_id,
                    user_id=auth.user_id,
                    role="owner",
                )
            )
        self.db.flush()

    def _create_import_job(
        self,
        workspace_id: str,
        source_file_id: str,
        status_value: ImportStatus,
        total_rows: int,
        valid_rows: int,
        error_rows: int,
    ) -> ImportJob:
        now = datetime.now(UTC)
        return ImportJob(
            id=str(uuid4()),
            workspace_id=workspace_id,
            source_file_id=source_file_id,
            status=status_value.value,
            started_at=now,
            finished_at=now,
            total_rows=total_rows,
            valid_rows=valid_rows,
            error_rows=error_rows,
        )

    def _persist_raw_lines(
        self,
        auth: AuthContext,
        source_file: SourceFile,
        import_job: ImportJob,
        source_kind: SourceKind,
        content: str,
        valid_lines: set[int],
        invalid_lines: set[int],
    ) -> dict[int, RawTransactionLine]:
        raw_lines: dict[int, RawTransactionLine] = {}
        for source_line, raw_line in self._iter_data_lines(source_kind, content):
            if not raw_line.strip():
                continue
            parse_status = (
                "valid"
                if source_line in valid_lines
                else "invalid"
                if source_line in invalid_lines
                else "skipped"
            )
            model = RawTransactionLine(
                id=str(uuid4()),
                workspace_id=auth.workspace_id,
                source_file_id=source_file.id,
                import_job_id=import_job.id,
                source_line=source_line,
                raw_payload={"line": raw_line},
                parse_status=parse_status,
            )
            self.db.add(model)
            raw_lines[source_line] = model
        self.db.flush()
        return raw_lines

    def _iter_data_lines(self, source_kind: SourceKind, content: str) -> list[tuple[int, str]]:
        lines = list(enumerate(content.splitlines(), start=1))
        if source_kind == SourceKind.CREDIT_CARD_CSV:
            return [(line_number, line) for line_number, line in lines if line_number > 1]
        return lines

    def _transaction_dedupe_key(
        self,
        workspace_id: str,
        source_type: str,
        transaction_date: str,
        raw_description: str,
        amount: str,
        direction: str,
    ) -> str:
        raw_key = "|".join(
            [
                workspace_id,
                source_type,
                transaction_date,
                raw_description,
                amount,
                direction,
            ]
        )
        return sha256(raw_key.encode("utf-8")).hexdigest()

    def _find_existing_transaction(
        self,
        workspace_id: str,
        source_type: str,
        transaction_date: date,
        raw_description: str,
        amount: Decimal,
        direction: str,
    ) -> Transaction | None:
        return self.db.scalar(
            select(Transaction).where(
                Transaction.workspace_id == workspace_id,
                Transaction.source_type == source_type,
                Transaction.transaction_date == transaction_date,
                Transaction.raw_description == raw_description,
                Transaction.amount == amount,
                Transaction.direction == direction,
            )
        )

    def _source_type(self, source_kind: str) -> str:
        if source_kind == SourceKind.BANK_STATEMENT_TXT.value:
            return "bank_statement"
        if source_kind == SourceKind.CREDIT_CARD_CSV.value:
            return "credit_card_statement"
        return "unknown"
