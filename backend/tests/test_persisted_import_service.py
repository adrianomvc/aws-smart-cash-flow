from collections.abc import Iterator
from datetime import date
from decimal import Decimal
from io import BytesIO
from uuid import uuid4

import pytest
from fastapi import UploadFile
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.auth import AuthContext
from app.db.models import (
    Base,
    FinancialCalendarEvent,
    ImportError,
    ImportJob,
    RawTransactionLine,
    SourceFile,
    Transaction,
)
from app.domain.imports import (
    ImportStatus,
    ParsedCalendarEvent,
    ParsedTransaction,
    ParseResult,
    SourceKind,
    TransactionDirection,
)
from app.services.import_service import ImportService
from app.services.storage_service import StoredFile


@pytest.fixture()
def db_session() -> Iterator[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)

    with session_factory() as session:
        yield session


def test_import_records_file_job_raw_lines_transactions_and_errors(
    db_session: Session,
) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))
    service = ImportService(db_session)

    result = service.import_bytes(
        auth=auth,
        filename="fatura-maio.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura-maio.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2026-05-08,PADARIA S\xc3\x83O JOS\xc3\x89 CAF\xc3\x89,26.06\n"
        b"2026-99-08,DATA INVALIDA,10.00\n",
    )

    assert result.status == ImportStatus.COMPLETED_WITH_ERRORS
    assert result.total_rows == 2
    assert result.valid_rows == 1
    assert result.error_rows == 1
    assert result.duplicate_rows == 0

    source_files = db_session.scalars(select(SourceFile)).all()
    import_jobs = db_session.scalars(select(ImportJob)).all()
    raw_lines = db_session.scalars(
        select(RawTransactionLine).order_by(RawTransactionLine.source_line)
    ).all()
    transactions = db_session.scalars(select(Transaction)).all()
    errors = db_session.scalars(select(ImportError)).all()

    assert len(source_files) == 1
    assert source_files[0].workspace_id == auth.workspace_id
    assert source_files[0].source_kind == "credit_card_csv"
    assert source_files[0].storage_bucket == "financial-files"
    assert source_files[0].storage_path == f"{auth.workspace_id}/fatura-maio.csv"

    assert len(import_jobs) == 1
    assert import_jobs[0].status == ImportStatus.COMPLETED_WITH_ERRORS
    assert import_jobs[0].total_rows == 2
    assert import_jobs[0].valid_rows == 1
    assert import_jobs[0].error_rows == 1

    assert [(line.source_line, line.parse_status) for line in raw_lines] == [
        (2, "valid"),
        (3, "invalid"),
    ]

    assert len(transactions) == 1
    assert transactions[0].workspace_id == auth.workspace_id
    assert transactions[0].source_file_id == source_files[0].id
    assert transactions[0].import_job_id == import_jobs[0].id
    assert transactions[0].source_type == "credit_card_statement"
    assert transactions[0].description == "PADARIA SAO JOSE CAFE"
    assert transactions[0].raw_description == "PADARIA SÃO JOSÉ CAFÉ"
    assert transactions[0].amount == Decimal("26.06")
    assert transactions[0].currency == "BRL"
    assert transactions[0].direction == "debit"
    assert transactions[0].source_line == 2
    assert transactions[0].dedupe_key

    assert len(errors) == 1
    assert errors[0].workspace_id == auth.workspace_id
    assert errors[0].import_job_id == import_jobs[0].id
    assert errors[0].source_line == 3
    assert errors[0].field_name == "data"
    assert errors[0].raw_value == "2026-99-08"
    assert errors[0].error_code == "invalid_date"


def test_import_dedupes_same_file_in_same_workspace(db_session: Session) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))
    service = ImportService(db_session)
    content = b"01/07/2025;PIX TRANSF DANIELL01/07;-10,00\n"

    first = service.import_bytes(
        auth=auth,
        filename="extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/first/extrato.txt",
        content=content,
    )
    duplicate = service.import_bytes(
        auth=auth,
        filename="extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/second/extrato.txt",
        content=content,
    )

    assert first.status == ImportStatus.COMPLETED
    assert duplicate.status == ImportStatus.DUPLICATE_FILE
    assert duplicate.duplicate_rows == 0
    assert db_session.scalar(select(func.count()).select_from(SourceFile)) == 1
    assert db_session.scalar(select(func.count()).select_from(Transaction)) == 1
    assert db_session.scalar(select(func.count()).select_from(ImportJob)) == 2


def test_import_allows_same_file_after_transactions_are_deleted(db_session: Session) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))
    service = ImportService(db_session)
    content = b"01/07/2025;PIX TRANSF DANIELL01/07;-10,00\n"

    first = service.import_bytes(
        auth=auth,
        filename="extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/first/extrato.txt",
        content=content,
    )
    db_session.query(Transaction).filter(
        Transaction.source_file_id == first.source_file_id
    ).delete()
    db_session.commit()

    preview = service.preview_bytes(
        auth=auth,
        filename="extrato.txt",
        content=content,
    )
    second = service.import_bytes(
        auth=auth,
        filename="extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/second/extrato.txt",
        content=content,
    )

    assert preview.duplicate_file is False
    assert second.status == ImportStatus.COMPLETED
    assert second.source_file_id == first.source_file_id
    assert second.valid_rows == 1
    assert second.duplicate_rows == 0
    assert db_session.scalar(select(func.count()).select_from(SourceFile)) == 1
    assert db_session.scalar(select(func.count()).select_from(Transaction)) == 1
    assert db_session.scalar(select(func.count()).select_from(ImportJob)) == 2


def test_import_does_not_mark_file_duplicate_when_only_hidden_legacy_transactions_remain(
    db_session: Session,
) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))
    service = ImportService(db_session)
    content = b"01/07/2025;PIX TRANSF DANIELL01/07;-10,00\n"

    first = service.import_bytes(
        auth=auth,
        filename="extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/first/extrato.txt",
        content=content,
    )
    transaction = db_session.scalars(select(Transaction)).one()
    transaction.natural_dedupe_key = None
    db_session.commit()

    preview = service.preview_bytes(
        auth=auth,
        filename="extrato.txt",
        content=content,
    )
    second = service.import_bytes(
        auth=auth,
        filename="extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/second/extrato.txt",
        content=content,
    )

    assert preview.duplicate_file is False
    assert second.status == ImportStatus.COMPLETED
    assert second.source_file_id == first.source_file_id
    assert second.valid_rows == 0
    assert second.duplicate_rows == 1


def test_import_dedupes_overlapping_transactions_from_new_file(db_session: Session) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))
    service = ImportService(db_session)

    first = service.import_bytes(
        auth=auth,
        filename="extrato-julho.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/extrato-julho.txt",
        content=b"01/07/2025;PIX MERCADO;-10,00\n",
    )
    overlap = service.import_bytes(
        auth=auth,
        filename="extrato-julho-agosto.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/extrato-julho-agosto.txt",
        content=(
            b"01/07/2025;PIX MERCADO;-10,00\n"
            b"01/08/2025;SALARIO;100,00\n"
        ),
    )

    assert first.status == ImportStatus.COMPLETED
    assert overlap.status == ImportStatus.COMPLETED
    assert overlap.total_rows == 2
    assert overlap.valid_rows == 1
    assert overlap.error_rows == 0
    assert overlap.duplicate_rows == 1
    assert db_session.scalar(select(func.count()).select_from(SourceFile)) == 2
    assert db_session.scalar(select(func.count()).select_from(Transaction)) == 2

    second_job = db_session.get(ImportJob, overlap.import_job_id)
    assert second_job is not None
    assert second_job.total_rows == 2
    assert second_job.valid_rows == 1
    assert second_job.error_rows == 0


def test_import_natural_dedupe_ignores_noisy_numeric_description_tokens(
    db_session: Session,
) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))
    service = ImportService(db_session)

    first = service.import_bytes(
        auth=auth,
        filename="cartao-a.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/cartao-a.csv",
        content=b"data,lan\xc3\xa7amento,valor\n2026-05-08,BKI PM SAO PAU 626400399,26.06\n",
    )
    second = service.import_bytes(
        auth=auth,
        filename="cartao-b.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/cartao-b.csv",
        content=b"data,lan\xc3\xa7amento,valor\n2026-05-08,BKI PM SAO PAU 123456789,26.06\n",
    )

    assert first.valid_rows == 1
    assert second.valid_rows == 0
    assert second.duplicate_rows == 1
    assert db_session.scalar(select(func.count()).select_from(Transaction)) == 1


def test_import_dedupe_is_scoped_by_workspace(db_session: Session) -> None:
    service = ImportService(db_session)
    user_id = str(uuid4())
    content = b"01/07/2025;PIX TRANSF DANIELL01/07;-10,00\n"

    for workspace_id in [str(uuid4()), str(uuid4())]:
        result = service.import_bytes(
            auth=AuthContext(user_id=user_id, workspace_id=workspace_id),
            filename="extrato.txt",
            mime_type="text/plain",
            storage_bucket="financial-files",
            storage_path=f"{workspace_id}/extrato.txt",
            content=content,
        )

        assert result.status == ImportStatus.COMPLETED

    assert db_session.scalar(select(func.count()).select_from(SourceFile)) == 2
    assert db_session.scalar(select(func.count()).select_from(Transaction)) == 2


def test_import_dedupes_transactions_when_file_changes_one_line(db_session: Session) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))
    service = ImportService(db_session)
    first_content = (
        b"01/07/2025;PIX TRANSF DANIELL01/07;-10,00\n"
        b"02/07/2025;MERCADO CENTRAL;-50,00\n"
    )
    changed_content = (
        b"01/07/2025;PIX TRANSF DANIELL01/07;-10,00\n"
        b"03/07/2025;FARMACIA VIDA;-25,00\n"
    )

    first = service.import_bytes(
        auth=auth,
        filename="extrato-a.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/first/extrato.txt",
        content=first_content,
    )
    changed = service.import_bytes(
        auth=auth,
        filename="extrato-a-ajustado.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/second/extrato.txt",
        content=changed_content,
    )

    assert first.valid_rows == 2
    assert first.duplicate_rows == 0
    assert changed.status == ImportStatus.COMPLETED
    assert changed.total_rows == 2
    assert changed.valid_rows == 1
    assert changed.duplicate_rows == 1
    assert db_session.scalar(select(func.count()).select_from(SourceFile)) == 2
    assert db_session.scalar(select(func.count()).select_from(ImportJob)) == 2
    assert db_session.scalar(select(func.count()).select_from(Transaction)) == 3


def test_persist_transaction_reuses_same_source_file_and_line(db_session: Session) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))
    service = ImportService(db_session)

    result = service.import_bytes(
        auth=auth,
        filename="extrato-a.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/extrato-a.txt",
        content=b"01/07/2025;PIX TRANSF DANIELL01/07;-10,00\n",
    )

    source_file = db_session.scalars(select(SourceFile)).one()
    import_job = db_session.scalars(select(ImportJob)).one()
    raw_line = db_session.scalars(select(RawTransactionLine)).one()
    parsed = ParsedTransaction(
        transaction_date=date(2025, 7, 1),
        raw_description="PIX TRANSF DANIELL01/07",
        description="PIX TRANSF DANIELL01/07",
        amount=Decimal("-10.00"),
        direction=TransactionDirection.DEBIT,
        source_line=1,
    )

    duplicate = service.persist_transaction(
        workspace_id=auth.workspace_id,
        source_file=source_file,
        import_job=import_job,
        raw_line=raw_line,
        parsed_transaction=parsed,
    )

    assert result.status == ImportStatus.COMPLETED
    assert duplicate.id == db_session.scalars(select(Transaction)).one().id
    assert db_session.scalar(select(func.count()).select_from(SourceFile)) == 1
    assert db_session.scalar(select(func.count()).select_from(Transaction)) == 1


def test_import_persists_credit_card_installment_metadata(db_session: Session) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))

    result = ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura.csv",
        content=b"data,lan\xc3\xa7amento,valor\n2026-02-23,ANGLO 03/10,6536.76\n",
    )

    transaction = db_session.scalars(select(Transaction)).one()

    assert result.status == ImportStatus.COMPLETED
    assert transaction.description == "ANGLO"
    assert transaction.raw_description == "ANGLO 03/10"
    assert transaction.installment_current == 3
    assert transaction.installment_total == 10


def test_import_persists_excel_future_rows_as_calendar_events(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))

    def fake_parse_excel_bank_statement(_content: bytes) -> ParseResult:
        return ParseResult(
            source_kind=SourceKind.BANK_STATEMENT_EXCEL,
            total_rows=1,
            calendar_events=[
                ParsedCalendarEvent(
                    title="TED AGENDADA",
                    event_type="expense",
                    amount=Decimal("120.00"),
                    due_date=date(2026, 1, 5),
                    source_line=12,
                    raw_payload={"descricao": "TED AGENDADA"},
                )
            ],
        )

    monkeypatch.setattr(
        "app.services.import_service.parse_excel_bank_statement",
        fake_parse_excel_bank_statement,
    )

    result = ImportService(db_session).import_bytes(
        auth=auth,
        filename="extrato.xls",
        mime_type="application/vnd.ms-excel",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/extrato.xls",
        content=b"fake-xls",
        source_kind=SourceKind.BANK_STATEMENT_EXCEL.value,
    )

    event = db_session.scalars(select(FinancialCalendarEvent)).one()

    assert result.status == ImportStatus.COMPLETED
    assert result.valid_rows == 1
    assert result.duplicate_rows == 0
    assert db_session.scalar(select(func.count()).select_from(Transaction)) == 0
    assert event.workspace_id == auth.workspace_id
    assert event.title == "TED AGENDADA"
    assert event.event_type == "expense"
    assert event.amount == Decimal("120.00")
    assert event.due_date == date(2026, 1, 5)
    assert event.status == "planned"
    assert event.recurrence == "none"


def test_import_keeps_different_installments_as_distinct_transactions(
    db_session: Session,
) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))

    result = ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2026-02-24,ANGLO 02/10,6536.76\n"
        b"2026-02-24,ANGLO 03/10,6536.76\n"
        b"2026-02-24,ANGLO 04/10,6536.76\n",
    )

    transactions = db_session.scalars(
        select(Transaction).order_by(Transaction.installment_current)
    ).all()

    assert result.status == ImportStatus.COMPLETED
    assert result.valid_rows == 3
    assert result.duplicate_rows == 0
    assert [(item.installment_current, item.installment_total) for item in transactions] == [
        (2, 10),
        (3, 10),
        (4, 10),
    ]
    assert len({item.natural_dedupe_key for item in transactions}) == 3


def test_import_keeps_repeated_credit_card_rows_from_same_statement(
    db_session: Session,
) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))
    content = (
        b"data,lan\xc3\xa7amento,valor\n"
        b"2026-05-05,METRO -CT,5.40\n"
        b"2026-05-05,METRO -CT,5.40\n"
    )

    result = ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura-maio.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura-maio.csv",
        content=content,
    )

    transactions = db_session.scalars(
        select(Transaction).order_by(Transaction.source_line)
    ).all()

    assert result.status == ImportStatus.COMPLETED
    assert result.valid_rows == 2
    assert result.duplicate_rows == 0
    assert [item.amount for item in transactions] == [Decimal("5.40"), Decimal("5.40")]
    assert [item.source_line for item in transactions] == [2, 3]
    assert len({item.natural_dedupe_key for item in transactions}) == 2


def test_import_blocks_same_credit_card_file_even_with_repeated_rows(
    db_session: Session,
) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))
    service = ImportService(db_session)
    content = (
        b"data,lan\xc3\xa7amento,valor\n"
        b"2026-05-05,METRO -CT,5.40\n"
        b"2026-05-05,METRO -CT,5.40\n"
    )

    first = service.import_bytes(
        auth=auth,
        filename="fatura-maio.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/first/fatura-maio.csv",
        content=content,
    )
    duplicate = service.import_bytes(
        auth=auth,
        filename="fatura-maio.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/second/fatura-maio.csv",
        content=content,
    )

    assert first.status == ImportStatus.COMPLETED
    assert duplicate.status == ImportStatus.DUPLICATE_FILE
    assert db_session.scalar(select(func.count()).select_from(SourceFile)) == 1
    assert db_session.scalar(select(func.count()).select_from(Transaction)) == 2


class FakeStorage:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, bytes, str | None]] = []

    def store_original_file(
        self,
        workspace_id: str,
        original_filename: str,
        content: bytes,
        source_file_id: str | None = None,
    ) -> StoredFile:
        self.calls.append((workspace_id, original_filename, content, source_file_id))
        return StoredFile(
            bucket="financial-files",
            path=f"{workspace_id}/{source_file_id}/{original_filename}",
        )


@pytest.mark.anyio
async def test_process_upload_stores_original_file_before_persisting(
    db_session: Session,
) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))
    storage = FakeStorage()
    service = ImportService(db_session, storage=storage)
    upload = UploadFile(
        filename="extrato.txt",
        file=BytesIO(b"01/07/2025;PIX TRANSF DANIELL01/07;-10,00\n"),
    )

    result = await service.process_upload(auth=auth, file=upload)

    source_file = db_session.scalars(select(SourceFile)).one()
    assert result.status == ImportStatus.COMPLETED
    assert len(storage.calls) == 1
    assert storage.calls[0][0] == auth.workspace_id
    assert storage.calls[0][1] == "extrato.txt"
    assert storage.calls[0][3] == source_file.id
    assert source_file.storage_bucket == "financial-files"
    assert source_file.storage_path == f"{auth.workspace_id}/{source_file.id}/extrato.txt"


@pytest.mark.anyio
async def test_process_upload_does_not_store_duplicate_file_again(
    db_session: Session,
) -> None:
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))
    storage = FakeStorage()
    service = ImportService(db_session, storage=storage)
    content = b"01/07/2025;PIX TRANSF DANIELL01/07;-10,00\n"

    first = UploadFile(filename="extrato.txt", file=BytesIO(content))
    duplicate = UploadFile(filename="extrato.txt", file=BytesIO(content))

    await service.process_upload(auth=auth, file=first)
    result = await service.process_upload(auth=auth, file=duplicate)

    assert result.status == ImportStatus.DUPLICATE_FILE
    assert len(storage.calls) == 1
    assert db_session.scalar(select(func.count()).select_from(SourceFile)) == 1
    assert db_session.scalar(select(func.count()).select_from(ImportJob)) == 2
