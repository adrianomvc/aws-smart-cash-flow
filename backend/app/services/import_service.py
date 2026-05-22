from datetime import UTC, datetime
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
)
from app.domain.imports import (
    ImportPreviewResult,
    ImportResult,
    ImportStatus,
    ParsedTransaction,
    PreviewTransaction,
    SourceKind,
)
from app.services.categorization_service import CategorizationService
from app.services.file_classifier import classify_file
from app.services.parsers import (
    normalize_transaction_description,
    parse_credit_card_csv,
    parse_txt_bank_statement,
)
from app.services.storage_service import StorageService
from app.services.workspace_service import WorkspaceService


class ImportService:
    max_upload_bytes = 2 * 1024 * 1024

    def __init__(self, db: Session, storage: StorageService | None = None) -> None:
        self.db = db
        self.storage = storage or StorageService()

    async def process_upload(
        self,
        auth: AuthContext,
        file: UploadFile,
        source_kind: str | None = None,
    ) -> ImportResult:
        filename = file.filename or "upload"
        raw_bytes = await file.read()
        _, workspace, _ = WorkspaceService(self.db).get_or_create_current_workspace(auth)
        content_hash = sha256(raw_bytes).hexdigest()
        existing_source_file = self.db.scalar(
            select(SourceFile).where(
                SourceFile.workspace_id == workspace.id,
                SourceFile.content_hash == content_hash,
            )
        )
        if existing_source_file is not None:
            return self.import_bytes(
                auth=AuthContext(user_id=auth.user_id, workspace_id=workspace.id, email=auth.email),
                filename=filename,
                mime_type=file.content_type or "application/octet-stream",
                storage_bucket=existing_source_file.storage_bucket,
            storage_path=existing_source_file.storage_path,
            content=raw_bytes,
            source_kind=source_kind,
        )

        source_file_id = str(uuid4())
        stored_file = self.storage.store_original_file(
            workspace_id=workspace.id,
            original_filename=filename,
            content=raw_bytes,
            source_file_id=source_file_id,
        )
        return self.import_bytes(
            auth=AuthContext(user_id=auth.user_id, workspace_id=workspace.id, email=auth.email),
            filename=filename,
            mime_type=file.content_type or "application/octet-stream",
            storage_bucket=stored_file.bucket,
            storage_path=stored_file.path,
            content=raw_bytes,
            source_file_id=source_file_id,
            source_kind=source_kind,
        )

    async def preview_upload(
        self,
        auth: AuthContext,
        file: UploadFile,
        source_kind: str | None = None,
    ) -> ImportPreviewResult:
        filename = file.filename or "upload"
        raw_bytes = await file.read()
        return self.preview_bytes(
            auth=auth,
            filename=filename,
            content=raw_bytes,
            source_kind=source_kind,
        )

    def preview_bytes(
        self,
        auth: AuthContext,
        filename: str,
        content: bytes,
        source_kind: str | None = None,
    ) -> ImportPreviewResult:
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
        try:
            text_content = content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be encoded as UTF-8",
            ) from exc

        parsed_source_kind = self._resolve_source_kind(filename, text_content, source_kind)
        parse_result = self._parse(parsed_source_kind, text_content)
        _, workspace, _ = WorkspaceService(self.db).get_or_create_current_workspace(auth)
        content_hash = sha256(content).hexdigest()
        duplicate_file = self.db.scalar(
            select(SourceFile.id).where(
                SourceFile.workspace_id == workspace.id,
                SourceFile.content_hash == content_hash,
            )
        ) is not None
        source_type = self._source_type(parsed_source_kind.value)
        duplicate_rows = 0
        preview_items: list[PreviewTransaction] = []
        for transaction in parse_result.transactions:
            natural_key = self._natural_transaction_dedupe_key(
                workspace_id=workspace.id,
                source_type=source_type,
                transaction_date=transaction.transaction_date.isoformat(),
                raw_description=transaction.raw_description,
                amount=self._normalize_amount(transaction.amount),
                direction=transaction.direction.value,
            )
            duplicate = self.db.scalar(
                select(Transaction.id).where(
                    Transaction.workspace_id == workspace.id,
                    Transaction.natural_dedupe_key == natural_key,
                )
            ) is not None
            if duplicate:
                duplicate_rows += 1
            if len(preview_items) < 50:
                preview_items.append(
                    PreviewTransaction(
                        source_line=transaction.source_line,
                        transaction_date=transaction.transaction_date,
                        description=transaction.description,
                        amount=transaction.amount,
                        direction=transaction.direction,
                        duplicate=duplicate,
                    )
                )

        return ImportPreviewResult(
            filename=filename,
            source_kind=parsed_source_kind,
            duplicate_file=duplicate_file,
            total_rows=parse_result.total_rows,
            valid_rows=len(parse_result.transactions),
            error_rows=len(parse_result.errors),
            duplicate_rows=len(parse_result.transactions) if duplicate_file else duplicate_rows,
            items=preview_items,
            errors=parse_result.errors[:50],
        )

    def import_bytes(
        self,
        auth: AuthContext,
        filename: str,
        mime_type: str,
        storage_bucket: str,
        storage_path: str,
        content: bytes,
        source_file_id: str | None = None,
        source_kind: str | None = None,
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

        parsed_source_kind = self._resolve_source_kind(filename, text_content, source_kind)
        parse_result = self._parse(parsed_source_kind, text_content)

        _, workspace, _ = WorkspaceService(self.db).get_or_create_current_workspace(auth)
        workspace_id = workspace.id
        existing_source_file = self.db.scalar(
            select(SourceFile).where(
                SourceFile.workspace_id == workspace_id,
                SourceFile.content_hash == content_hash,
            )
        )
        if existing_source_file is not None:
            import_job = self._create_import_job(
                workspace_id=workspace_id,
                source_file_id=existing_source_file.id,
                status_value=ImportStatus.DUPLICATE_FILE,
                total_rows=0,
                valid_rows=0,
                error_rows=0,
                duplicate_rows=0,
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
            id=source_file_id or str(uuid4()),
            workspace_id=workspace_id,
            original_filename=filename,
            content_hash=content_hash,
            mime_type=mime_type,
            size_bytes=len(content),
            storage_bucket=storage_bucket,
            storage_path=storage_path,
            source_kind=parsed_source_kind.value,
            created_by_user_id=auth.user_id,
        )
        import_job = self._create_import_job(
            workspace_id=workspace_id,
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
            workspace_id=workspace_id,
            source_file=source_file,
            import_job=import_job,
            source_kind=parsed_source_kind,
            content=text_content,
            valid_lines={transaction.source_line for transaction in parse_result.transactions},
            invalid_lines={error.source_line for error in parse_result.errors if error.source_line},
        )
        persisted_transactions = 0
        duplicate_transactions = 0
        for parsed_transaction in parse_result.transactions:
            transaction = self.persist_transaction(
                workspace_id=workspace_id,
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
                    workspace_id=workspace_id,
                    import_job_id=import_job.id,
                    source_line=parse_error.source_line,
                    field_name=parse_error.field_name,
                    raw_value=parse_error.raw_value,
                    error_code=parse_error.error_code,
                    message=parse_error.message,
                )
            )

        import_job.valid_rows = persisted_transactions
        import_job.duplicate_rows = duplicate_transactions
        CategorizationService(self.db).apply_rules(workspace_id)
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
        dedupe_key = self._transaction_dedupe_key(
            workspace_id=workspace_id,
            source_file_id=source_file.id,
            source_line=parsed_transaction.source_line,
            transaction_date=parsed_transaction.transaction_date.isoformat(),
            raw_description=parsed_transaction.raw_description,
            amount=self._normalize_amount(parsed_transaction.amount),
        )
        source_type = self._source_type(source_file.source_kind)
        natural_dedupe_key = self._natural_transaction_dedupe_key(
            workspace_id=workspace_id,
            source_type=source_type,
            transaction_date=parsed_transaction.transaction_date.isoformat(),
            raw_description=parsed_transaction.raw_description,
            amount=self._normalize_amount(parsed_transaction.amount),
            direction=parsed_transaction.direction.value,
        )
        existing_transaction = self.db.scalar(
            select(Transaction).where(
                Transaction.workspace_id == workspace_id,
                Transaction.dedupe_key == dedupe_key,
            )
        )
        if existing_transaction is not None:
            return existing_transaction

        existing_natural_transaction = self.db.scalar(
            select(Transaction).where(
                Transaction.workspace_id == workspace_id,
                Transaction.natural_dedupe_key == natural_dedupe_key,
            )
        )
        if existing_natural_transaction is not None:
            return existing_natural_transaction

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
            natural_dedupe_key=natural_dedupe_key,
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

    def _resolve_source_kind(
        self,
        filename: str,
        content: str,
        source_kind: str | None,
    ) -> SourceKind:
        if not source_kind or source_kind == "auto":
            return classify_file(filename, content)
        try:
            resolved = SourceKind(source_kind)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid source_kind. Use auto, bank_statement_txt, or credit_card_csv.",
            ) from exc
        if resolved == SourceKind.UNKNOWN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid source_kind. Use auto, bank_statement_txt, or credit_card_csv.",
            )
        return resolved

    def _create_import_job(
        self,
        workspace_id: str,
        source_file_id: str,
        status_value: ImportStatus,
        total_rows: int,
        valid_rows: int,
        error_rows: int,
        duplicate_rows: int = 0,
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
            duplicate_rows=duplicate_rows,
        )

    def _persist_raw_lines(
        self,
        workspace_id: str,
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
                workspace_id=workspace_id,
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
        source_file_id: str,
        source_line: int,
        transaction_date: str,
        raw_description: str,
        amount: str,
    ) -> str:
        raw_key = "|".join(
            [
                workspace_id,
                source_file_id,
                str(source_line),
                transaction_date,
                raw_description,
                amount,
            ]
        )
        return sha256(raw_key.encode("utf-8")).hexdigest()

    def _natural_transaction_dedupe_key(
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
                self._normalize_description(raw_description),
                amount,
                direction,
            ]
        )
        return sha256(raw_key.encode("utf-8")).hexdigest()

    def _normalize_description(self, value: str) -> str:
        return normalize_transaction_description(value)

    def _normalize_amount(self, value: Decimal) -> str:
        return str(value.quantize(Decimal("0.01")))

    def _source_type(self, source_kind: str) -> str:
        if source_kind == SourceKind.BANK_STATEMENT_TXT.value:
            return "bank_statement"
        if source_kind == SourceKind.CREDIT_CARD_CSV.value:
            return "credit_card_statement"
        return "unknown"
