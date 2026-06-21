from datetime import UTC, date, datetime
from decimal import Decimal
from hashlib import sha256
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext
from app.db.models import (
    AccountBalance,
    CreditCard,
    CreditCardStatement,
    FinancialCalendarEvent,
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
    ParsedCalendarEvent,
    ParsedCreditCard,
    ParsedTransaction,
    ParseResult,
    PreviewTransaction,
    SourceKind,
)
from app.services.billing_dates import compute_payment_date
from app.services.categorization_service import CategorizationService
from app.services.file_classifier import classify_file
from app.services.merchant_aliases import apply_aliases, load_aliases
from app.services.parsers import (
    extract_installment_marker,
    normalize_transaction_description_for_dedupe,
    parse_credit_card_csv,
    parse_excel_bank_statement,
    parse_itau_credit_card_pdf,
    parse_txt_bank_statement,
)
from app.services.storage_service import StorageService
from app.services.workspace_service import WorkspaceService


class ImportService:
    max_upload_bytes = 2 * 1024 * 1024

    def __init__(self, db: Session, storage: StorageService | None = None) -> None:
        self.db = db
        self.storage = storage or StorageService()
        self._aliases_cache: dict[str, list[tuple[str, str]]] = {}

    def _merchant_aliases(self, workspace_id: str) -> list[tuple[str, str]]:
        """Workspace aliases, loaded once per import run."""
        if workspace_id not in self._aliases_cache:
            self._aliases_cache[workspace_id] = load_aliases(self.db, workspace_id)
        return self._aliases_cache[workspace_id]

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
        if suffix not in {"txt", "csv", "xls", "pdf"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only TXT, CSV, XLS Excel and PDF files are supported",
            )
        if len(content) > self.max_upload_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File exceeds MVP upload limit",
            )
        parsed_source_kind = self._resolve_source_kind(filename, content, source_kind)
        text_content = self._decode_text_content(parsed_source_kind, content)
        parse_result = self._parse(parsed_source_kind, content, text_content)
        _, workspace, _ = WorkspaceService(self.db).get_or_create_current_workspace(auth)
        content_hash = sha256(content).hexdigest()
        duplicate_source_file = self.db.scalar(
            select(SourceFile).where(
                SourceFile.workspace_id == workspace.id,
                SourceFile.content_hash == content_hash,
            )
        )
        has_valid_rows = bool(
            parse_result.transactions
            or parse_result.account_balances
            or parse_result.calendar_events
        )
        duplicate_file = duplicate_source_file is not None and (
            not has_valid_rows
            or self._source_file_has_imported_data(
                workspace_id=workspace.id,
                source_file_id=duplicate_source_file.id,
            )
        )
        source_type = self._source_type(parsed_source_kind.value)
        duplicate_rows = 0
        preview_items: list[PreviewTransaction] = []
        natural_key_payloads: list[dict[str, object]] = []
        for transaction in parse_result.transactions:
            natural_key = self._natural_transaction_dedupe_key(
                workspace_id=workspace.id,
                source_type=source_type,
                transaction_date=transaction.transaction_date.isoformat(),
                raw_description=transaction.raw_description,
                amount=self._normalize_amount(transaction.amount),
                direction=transaction.direction.value,
                installment_current=transaction.installment_current,
                installment_total=transaction.installment_total,
            )
            natural_key_payloads.append(
                {
                    "source_line": transaction.source_line,
                    "natural_dedupe_key": natural_key,
                }
            )
        self._assign_occurrence_natural_dedupe_keys(natural_key_payloads)
        # Use a positional list — dict-by-source_line would collapse two transactions
        # on the same line (two-column PDF layout), causing false duplicates.
        natural_keys_list = [str(p["natural_dedupe_key"]) for p in natural_key_payloads]

        existing_natural_keys = self._existing_transaction_natural_keys(
            workspace_id=workspace.id,
            natural_keys=set(natural_keys_list),
        )
        seen_natural_keys: set[str] = set()
        for i, transaction in enumerate(parse_result.transactions):
            natural_key = natural_keys_list[i]
            duplicate = natural_key in existing_natural_keys or natural_key in seen_natural_keys
            seen_natural_keys.add(natural_key)
            if duplicate:
                duplicate_rows += 1
            if len(preview_items) < 200:
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
            valid_rows=self._parse_result_valid_rows(parse_result),
            error_rows=len(parse_result.errors),
            duplicate_rows=(
                self._parse_result_valid_rows(parse_result)
                if duplicate_file
                else duplicate_rows
            ),
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
        if suffix not in {"txt", "csv", "xls", "pdf"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only TXT, CSV, XLS Excel and PDF files are supported",
            )
        if len(content) > self.max_upload_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File exceeds MVP upload limit",
            )

        content_hash = sha256(content).hexdigest()
        parsed_source_kind = self._resolve_source_kind(filename, content, source_kind)
        text_content = self._decode_text_content(parsed_source_kind, content)
        parse_result = self._parse(parsed_source_kind, content, text_content)

        _, workspace, _ = WorkspaceService(self.db).get_or_create_current_workspace(auth)
        workspace_id = workspace.id
        existing_source_file = self.db.scalar(
            select(SourceFile).where(
                SourceFile.workspace_id == workspace_id,
                SourceFile.content_hash == content_hash,
            )
        )
        has_valid_rows = bool(
            parse_result.transactions
            or parse_result.account_balances
            or parse_result.calendar_events
        )
        if existing_source_file is not None and (
            not has_valid_rows
            or self._source_file_has_imported_data(
                workspace_id=workspace_id,
                source_file_id=existing_source_file.id,
            )
        ):
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
            # Even when the rows are a duplicate, the card may have been deleted
            # (soft-deleted) since the first import. Re-running the same statement
            # must still re-register/re-activate its card and re-link the file.
            try:
                self._register_pdf_credit_card(
                    workspace_id, existing_source_file, parse_result
                )
                self.db.commit()
            except Exception:  # noqa: BLE001 - card registration must never break the import
                self.db.rollback()
            return ImportResult(
                import_job_id=import_job.id,
                source_file_id=existing_source_file.id,
                status=ImportStatus.DUPLICATE_FILE,
                total_rows=0,
                valid_rows=0,
                error_rows=0,
                duplicate_rows=0,
            )

        source_file = existing_source_file
        status_value = (
            ImportStatus.COMPLETED_WITH_ERRORS if parse_result.errors else ImportStatus.COMPLETED
        )
        if source_file is None:
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
            self.db.add(source_file)
        import_job = self._create_import_job(
            workspace_id=workspace_id,
            source_file_id=source_file.id,
            status_value=status_value,
            total_rows=parse_result.total_rows,
            valid_rows=0,
            error_rows=len(parse_result.errors),
        )
        self.db.add(import_job)
        self.db.flush()

        raw_lines = self._persist_raw_lines(
            workspace_id=workspace_id,
            source_file=source_file,
            import_job=import_job,
            source_kind=parsed_source_kind,
            content=text_content,
            valid_lines={
                transaction.source_line for transaction in parse_result.transactions
            }
            | {balance.source_line for balance in parse_result.account_balances}
            | {event.source_line for event in parse_result.calendar_events},
            invalid_lines={error.source_line for error in parse_result.errors if error.source_line},
        )
        persisted_transactions = 0
        duplicate_transactions = 0
        persisted_balances = 0
        persisted_calendar_events = 0
        duplicate_calendar_events = 0
        persisted_transaction_ids: set[str] = set()

        transaction_payloads = [
            self._transaction_payload(
                workspace_id=workspace_id,
                source_file=source_file,
                import_job=import_job,
                raw_line=raw_lines.get(parsed_transaction.source_line),
                parsed_transaction=parsed_transaction,
                card_info=parse_result.credit_card,
            )
            for parsed_transaction in parse_result.transactions
        ]
        self._assign_occurrence_natural_dedupe_keys(transaction_payloads)
        existing_dedupe_keys = self._existing_transaction_dedupe_keys(
            workspace_id=workspace_id,
            dedupe_keys={payload["dedupe_key"] for payload in transaction_payloads},
        )
        existing_natural_keys = self._existing_transaction_natural_keys(
            workspace_id=workspace_id,
            natural_keys={payload["natural_dedupe_key"] for payload in transaction_payloads},
        )
        seen_dedupe_keys: set[str] = set()
        seen_natural_keys: set[str] = set()
        for payload in transaction_payloads:
            dedupe_key = payload["dedupe_key"]
            natural_dedupe_key = payload["natural_dedupe_key"]
            duplicate = (
                dedupe_key in existing_dedupe_keys
                or natural_dedupe_key in existing_natural_keys
                or dedupe_key in seen_dedupe_keys
                or natural_dedupe_key in seen_natural_keys
            )
            seen_dedupe_keys.add(dedupe_key)
            seen_natural_keys.add(natural_dedupe_key)
            if duplicate:
                duplicate_transactions += 1
                continue
            transaction_id = str(uuid4())
            self.db.add(Transaction(id=transaction_id, **payload))
            persisted_transaction_ids.add(transaction_id)
            persisted_transactions += 1

        existing_balances = self._existing_account_balances(
            workspace_id=workspace_id,
            account_names={
                balance.account_name for balance in parse_result.account_balances
            },
            balance_dates={
                balance.balance_date for balance in parse_result.account_balances
            },
        )
        for parsed_balance in parse_result.account_balances:
            balance_key = (parsed_balance.account_name, parsed_balance.balance_date)
            existing_balance = existing_balances.get(balance_key)
            if existing_balance is None:
                existing_balance = AccountBalance(
                    id=str(uuid4()),
                    workspace_id=workspace_id,
                    source_file_id=source_file.id,
                    import_job_id=import_job.id,
                    account_name=parsed_balance.account_name,
                    balance_date=parsed_balance.balance_date,
                    balance_amount=parsed_balance.balance_amount,
                    source_line=parsed_balance.source_line,
                    raw_payload=parsed_balance.raw_payload,
                )
                self.db.add(existing_balance)
                existing_balances[balance_key] = existing_balance
            else:
                existing_balance.source_file_id = source_file.id
                existing_balance.import_job_id = import_job.id
                existing_balance.balance_amount = parsed_balance.balance_amount
                existing_balance.source_line = parsed_balance.source_line
                existing_balance.raw_payload = parsed_balance.raw_payload
            persisted_balances += 1

        existing_calendar_events = self._existing_calendar_event_keys(
            workspace_id=workspace_id,
            events=parse_result.calendar_events,
        )
        seen_calendar_events: set[tuple[str, str, Decimal, object]] = set()
        for parsed_event in parse_result.calendar_events:
            event_key = self._calendar_event_key(parsed_event)
            duplicate = event_key in existing_calendar_events or event_key in seen_calendar_events
            seen_calendar_events.add(event_key)
            if duplicate:
                duplicate_calendar_events += 1
                continue
            self.db.add(
                FinancialCalendarEvent(
                    id=str(uuid4()),
                    workspace_id=workspace_id,
                    title=parsed_event.title,
                    event_type=parsed_event.event_type,
                    amount=parsed_event.amount,
                    due_date=parsed_event.due_date,
                    recurrence="none",
                    status="planned",
                    notes=(
                        "Importado do Excel: "
                        f"{source_file.original_filename} linha {parsed_event.source_line}"
                    ),
                )
            )
            persisted_calendar_events += 1

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

        import_job.valid_rows = (
            persisted_transactions + persisted_balances + persisted_calendar_events
        )
        import_job.duplicate_rows = duplicate_transactions + duplicate_calendar_events
        if persisted_transaction_ids:
            CategorizationService(self.db).apply_rules(
                workspace_id,
                transaction_ids=persisted_transaction_ids,
            )
        self.db.commit()
        # Best-effort: auto-register the credit card this PDF statement belongs to,
        # using the identity read from the PDF itself.
        try:
            self._register_pdf_credit_card(workspace_id, source_file, parse_result)
            self.db.commit()
        except Exception:  # noqa: BLE001 - card registration must never break the import
            self.db.rollback()
        # Best-effort: link any credit-card files to a card now that new data
        # (invoice or its settling payment) may have arrived.
        try:
            from app.services.card_association_service import auto_associate_statements

            auto_associate_statements(self.db, workspace_id)
        except Exception:  # noqa: BLE001 - association must never break the import
            self.db.rollback()
        # Best-effort: auto-link new aportes to their goals (contributions rules).
        try:
            from app.services.goal_contribution_service import apply_goal_aporte_rules

            apply_goal_aporte_rules(self.db, workspace_id)
            self.db.commit()
        except Exception:  # noqa: BLE001 - goal linking must never break the import
            self.db.rollback()
        # New data arrived → drop cached analytics/copilot context for this workspace.
        from app.services.analytics_cache import invalidate as invalidate_analytics_cache
        from app.services.copilot_service import invalidate_context_cache

        invalidate_analytics_cache(workspace_id)
        invalidate_context_cache(workspace_id)
        return ImportResult(
            import_job_id=import_job.id,
            source_file_id=source_file.id,
            status=status_value,
            total_rows=parse_result.total_rows,
            valid_rows=persisted_transactions + persisted_balances + persisted_calendar_events,
            error_rows=len(parse_result.errors),
            duplicate_rows=duplicate_transactions + duplicate_calendar_events,
        )

    def _source_file_has_imported_data(self, workspace_id: str, source_file_id: str) -> bool:
        has_transaction = self.db.scalar(
            select(Transaction.id)
            .where(
                Transaction.workspace_id == workspace_id,
                Transaction.source_file_id == source_file_id,
                Transaction.natural_dedupe_key.is_not(None),
            )
            .limit(1)
        )
        if has_transaction is not None:
            return True
        return (
            self.db.scalar(
                select(AccountBalance.id)
                .where(
                    AccountBalance.workspace_id == workspace_id,
                    AccountBalance.source_file_id == source_file_id,
                )
                .limit(1)
            )
            is not None
        )

    def persist_transaction(
        self,
        workspace_id: str,
        source_file: SourceFile,
        import_job: ImportJob,
        raw_line: RawTransactionLine | None,
        parsed_transaction: ParsedTransaction,
        flush: bool = True,
    ) -> Transaction:
        payload = self._transaction_payload(
            workspace_id=workspace_id,
            source_file=source_file,
            import_job=import_job,
            raw_line=raw_line,
            parsed_transaction=parsed_transaction,
        )
        existing_transaction = self.db.scalar(
            select(Transaction).where(
                Transaction.workspace_id == workspace_id,
                Transaction.dedupe_key == payload["dedupe_key"],
            )
        )
        if existing_transaction is not None:
            return existing_transaction

        existing_natural_transaction = self.db.scalar(
            select(Transaction).where(
                Transaction.workspace_id == workspace_id,
                Transaction.natural_dedupe_key == payload["natural_dedupe_key"],
            )
        )
        if existing_natural_transaction is not None:
            return existing_natural_transaction

        transaction = Transaction(id=str(uuid4()), **payload)
        self.db.add(transaction)
        if flush:
            self.db.flush()
        return transaction

    def _transaction_payload(
        self,
        workspace_id: str,
        source_file: SourceFile,
        import_job: ImportJob,
        raw_line: RawTransactionLine | None,
        parsed_transaction: ParsedTransaction,
        card_info: ParsedCreditCard | None = None,
    ) -> dict:
        # Bank-statement parsers don't extract installments; backfill from an explicit
        # "PARC NN" marker (e.g. an IPVA paid in installments) so parceled bank charges
        # carry their installment number. Credit-card parsers already set this upstream.
        installment_current = parsed_transaction.installment_current
        installment_total = parsed_transaction.installment_total
        if installment_current is None:
            marker_current, marker_total = extract_installment_marker(
                parsed_transaction.raw_description
            )
            if marker_current is not None:
                installment_current = marker_current
                installment_total = marker_total
        # User-defined aliases rename the display description (e.g. "BANCO ITAU SA" -> "Itaú").
        description = parsed_transaction.description
        alias_replacement = apply_aliases(
            parsed_transaction.raw_description, description, self._merchant_aliases(workspace_id)
        )
        if alias_replacement is not None:
            description = alias_replacement
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
            installment_current=installment_current,
            installment_total=installment_total,
        )
        return {
            "workspace_id": workspace_id,
            "source_file_id": source_file.id,
            "import_job_id": import_job.id,
            "raw_transaction_line_id": raw_line.id if raw_line is not None else None,
            "source_type": source_type,
            "source_name": None,
            "account_or_card": None,
            "transaction_date": parsed_transaction.transaction_date,
            # The imported statement IS the invoice this purchase was charged on (the
            # bank already assigns purchases after the closing day to the next
            # invoice's PDF). So the payment date is that statement's due date — no
            # closing-day guessing. Fall back to a computed date for non-PDF sources.
            "payment_date": (
                card_info.due_date
                if source_type == "credit_card_statement" and card_info and card_info.due_date
                else compute_payment_date(
                    parsed_transaction.transaction_date,
                    source_type,
                    installment_current,
                    card_info.closing_day if card_info else None,
                    card_info.due_day if card_info else None,
                )
            ),
            "description": description,
            "raw_description": parsed_transaction.raw_description,
            "amount": parsed_transaction.amount,
            "currency": "BRL",
            "direction": parsed_transaction.direction.value,
            "installment_current": installment_current,
            "installment_total": installment_total,
            "source_line": parsed_transaction.source_line,
            "dedupe_key": dedupe_key,
            "natural_dedupe_key": natural_dedupe_key,
        }

    def _assign_occurrence_natural_dedupe_keys(self, payloads: list[dict[str, object]]) -> None:
        occurrences: dict[str, int] = {}
        for payload in payloads:
            natural_key = str(payload["natural_dedupe_key"])
            occurrence = occurrences.get(natural_key, 0) + 1
            occurrences[natural_key] = occurrence
            if occurrence == 1:
                continue
            payload["natural_dedupe_key"] = sha256(
                f"{natural_key}|occurrence|{occurrence}".encode()
            ).hexdigest()

    def _existing_transaction_dedupe_keys(
        self,
        workspace_id: str,
        dedupe_keys: set[str],
    ) -> set[str]:
        if not dedupe_keys:
            return set()
        return set(
            self.db.scalars(
                select(Transaction.dedupe_key).where(
                    Transaction.workspace_id == workspace_id,
                    Transaction.dedupe_key.in_(dedupe_keys),
                )
            ).all()
        )

    def _existing_transaction_natural_keys(
        self,
        workspace_id: str,
        natural_keys: set[str],
    ) -> set[str]:
        if not natural_keys:
            return set()
        return set(
            self.db.scalars(
                select(Transaction.natural_dedupe_key).where(
                    Transaction.workspace_id == workspace_id,
                    Transaction.natural_dedupe_key.in_(natural_keys),
                )
            ).all()
        )

    def _existing_account_balances(
        self,
        workspace_id: str,
        account_names: set[str],
        balance_dates: set,
    ) -> dict[tuple[str, object], AccountBalance]:
        if not account_names or not balance_dates:
            return {}
        balances = self.db.scalars(
            select(AccountBalance).where(
                AccountBalance.workspace_id == workspace_id,
                AccountBalance.account_name.in_(account_names),
                AccountBalance.balance_date.in_(balance_dates),
            )
        ).all()
        return {
            (balance.account_name, balance.balance_date): balance
            for balance in balances
        }

    def _existing_calendar_event_keys(
        self,
        workspace_id: str,
        events: list[ParsedCalendarEvent],
    ) -> set[tuple[str, str, Decimal, object]]:
        titles = {event.title for event in events}
        due_dates = {event.due_date for event in events}
        if not titles or not due_dates:
            return set()
        existing_events = self.db.scalars(
            select(FinancialCalendarEvent).where(
                FinancialCalendarEvent.workspace_id == workspace_id,
                FinancialCalendarEvent.title.in_(titles),
                FinancialCalendarEvent.due_date.in_(due_dates),
                FinancialCalendarEvent.amount.is_not(None),
            )
        ).all()
        return {
            (
                event.title,
                event.event_type,
                self._normalize_event_amount(event.amount),
                event.due_date,
            )
            for event in existing_events
            if event.amount is not None
        }

    def _calendar_event_key(
        self,
        event: ParsedCalendarEvent,
    ) -> tuple[str, str, Decimal, object]:
        return (
            event.title,
            event.event_type,
            self._normalize_event_amount(event.amount),
            event.due_date,
        )

    def _parse_result_valid_rows(self, parse_result) -> int:
        return (
            len(parse_result.transactions)
            + len(parse_result.account_balances)
            + len(parse_result.calendar_events)
        )

    def _parse(self, source_kind: SourceKind, raw_content: bytes, text_content: str):
        if source_kind == SourceKind.BANK_STATEMENT_TXT:
            return parse_txt_bank_statement(text_content)
        if source_kind == SourceKind.BANK_STATEMENT_EXCEL:
            return parse_excel_bank_statement(raw_content)
        if source_kind == SourceKind.CREDIT_CARD_CSV:
            return parse_credit_card_csv(text_content)
        if source_kind == SourceKind.CREDIT_CARD_PDF:
            return parse_itau_credit_card_pdf(raw_content)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported or unrecognized file layout",
        )

    def _resolve_source_kind(
        self,
        filename: str,
        content: bytes,
        source_kind: str | None,
    ) -> SourceKind:
        if not source_kind or source_kind == "auto":
            return classify_file(filename, content)
        try:
            resolved = SourceKind(source_kind)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Invalid source_kind. Use auto, bank_statement_txt, "
                    "bank_statement_excel, or credit_card_csv."
                ),
            ) from exc
        if resolved == SourceKind.UNKNOWN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Invalid source_kind. Use auto, bank_statement_txt, "
                    "bank_statement_excel, or credit_card_csv."
                ),
            )
        return resolved

    def _decode_text_content(self, source_kind: SourceKind, content: bytes) -> str:
        if source_kind in {SourceKind.BANK_STATEMENT_EXCEL, SourceKind.CREDIT_CARD_PDF}:
            return ""
        try:
            return content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be encoded as UTF-8",
            ) from exc

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
        if source_kind in {SourceKind.BANK_STATEMENT_EXCEL, SourceKind.CREDIT_CARD_PDF}:
            return []
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
        installment_current: int | None = None,
        installment_total: int | None = None,
    ) -> str:
        installment_key = (
            f"{installment_current}/{installment_total}"
            if installment_current is not None and installment_total is not None
            else ""
        )
        raw_key = "|".join(
            [
                workspace_id,
                source_type,
                transaction_date,
                self._normalize_description(raw_description),
                amount,
                direction,
                installment_key,
            ]
        )
        return sha256(raw_key.encode("utf-8")).hexdigest()

    def _normalize_description(self, value: str) -> str:
        return normalize_transaction_description_for_dedupe(value)

    def _normalize_amount(self, value: Decimal) -> str:
        return str(value.quantize(Decimal("0.01")))

    def _normalize_event_amount(self, value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"))

    def _source_type(self, source_kind: str) -> str:
        if source_kind in {
            SourceKind.BANK_STATEMENT_TXT.value,
            SourceKind.BANK_STATEMENT_EXCEL.value,
        }:
            return "bank_statement"
        if source_kind in {
            SourceKind.CREDIT_CARD_CSV.value,
            SourceKind.CREDIT_CARD_PDF.value,
        }:
            return "credit_card_statement"
        return "unknown"

    def _register_pdf_credit_card(
        self,
        workspace_id: str,
        source_file: SourceFile,
        parse_result: ParseResult,
    ) -> None:
        """Auto-create (or reuse) the credit card identified in a PDF statement and
        link this statement file to it, so the card shows up under Cartões."""
        card_info = parse_result.credit_card
        if card_info is None or card_info.due_date is None:
            return
        card = self.db.scalar(
            select(CreditCard).where(
                CreditCard.workspace_id == workspace_id,
                CreditCard.last_four == card_info.last_four,
            )
        )
        if card is None:
            card = CreditCard(
                id=str(uuid4()),
                workspace_id=workspace_id,
                name=card_info.name,
                issuer="Itaú",
                brand=card_info.brand,
                last_four=card_info.last_four,
                closing_day=card_info.closing_day or 1,
                due_day=card_info.due_day or 10,
                limit_amount=card_info.limit_amount,
                active=True,
            )
            self.db.add(card)
            self.db.flush()
        else:
            # Importing a statement means this card is in use again: re-activate it
            # (it may have been soft-deleted) and backfill the limit when newly known.
            if not card.active:
                card.active = True
            if card_info.limit_amount is not None and card.limit_amount is None:
                card.limit_amount = card_info.limit_amount
            self.db.add(card)

        already_linked = self.db.scalar(
            select(CreditCardStatement.id).where(
                CreditCardStatement.source_file_id == source_file.id
            )
        )
        if already_linked is not None:
            return
        due_date = card_info.due_date
        self.db.add(
            CreditCardStatement(
                id=str(uuid4()),
                workspace_id=workspace_id,
                credit_card_id=card.id,
                source_file_id=source_file.id,
                statement_month=date(due_date.year, due_date.month, 1),
                closing_date=card_info.closing_date,
                due_date=due_date,
                total_amount=card_info.statement_total,
                status="closed",
            )
        )
