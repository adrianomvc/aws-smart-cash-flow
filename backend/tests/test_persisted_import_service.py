from collections.abc import Iterator
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.auth import AuthContext
from app.db.models import Base, ImportError, ImportJob, RawTransactionLine, SourceFile, Transaction
from app.domain.imports import ImportStatus, ParsedTransaction, TransactionDirection
from app.services.import_service import ImportService


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
    assert transactions[0].description == "PADARIA SÃO JOSÉ CAFÉ"
    assert transactions[0].raw_description == "PADARIA SÃO JOSÉ CAFÉ"
    assert transactions[0].amount == Decimal("-26.06")
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
