from collections.abc import Iterator
from datetime import date
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth import AuthContext, get_auth_context
from app.db.models import (
    AccountBalance,
    Base,
    CreditCard,
    CreditCardStatement,
    ImportError,
    ImportJob,
    RawTransactionLine,
    SourceFile,
    Transaction,
)
from app.db.session import get_db
from app.domain.imports import ParsedAccountBalance, ParseResult, SourceKind
from app.main import create_app
from app.services.import_service import ImportService


@pytest.fixture()
def db_session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)

    with session_factory() as session:
        yield session


@pytest.fixture()
def auth() -> AuthContext:
    return AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))


@pytest.fixture()
def client(db_session: Session, auth: AuthContext) -> Iterator[TestClient]:
    app = create_app()

    def override_db() -> Iterator[Session]:
        yield db_session

    async def override_auth() -> AuthContext:
        return auth

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_auth_context] = override_auth

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_list_imports_returns_jobs_for_current_workspace(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    service = ImportService(db_session)
    first = service.import_bytes(
        auth=auth,
        filename="extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/extrato.txt",
        content=b"01/07/2025;PIX TRANSF DANIELL01/07;-10,00\n",
    )
    other_auth = AuthContext(user_id=auth.user_id, workspace_id=str(uuid4()))
    service.import_bytes(
        auth=other_auth,
        filename="outro-extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{other_auth.workspace_id}/outro-extrato.txt",
        content=b"01/07/2025;PIX OUTRO;-20,00\n",
    )

    response = client.get("/v1/imports")

    assert response.status_code == 200
    payload = response.json()
    assert payload["workspace_id"] == auth.workspace_id
    assert [item["id"] for item in payload["items"]] == [first.import_job_id]
    assert payload["total"] == 1
    assert payload["limit"] == 50
    assert payload["offset"] == 0
    assert payload["items"][0]["source_file"]["original_filename"] == "extrato.txt"
    assert payload["items"][0]["duplicate_rows"] == 0


def test_create_import_accepts_manual_source_kind(
    client: TestClient,
) -> None:
    response = client.post(
        "/v1/imports",
        data={"source_kind": "credit_card_csv"},
        files={
            "file": (
                "fatura-renomeada.txt",
                b"data,lan\xc3\xa7amento,valor\n2026-05-08,PADARIA,26.06\n",
                "text/plain",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    assert payload["valid_rows"] == 1

    list_response = client.get("/v1/imports")
    assert list_response.status_code == 200
    assert list_response.json()["items"][0]["source_file"]["source_kind"] == "credit_card_csv"


def test_create_import_accepts_excel_bank_statement(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_parse_excel_bank_statement(_content: bytes) -> ParseResult:
        return ParseResult(
            source_kind=SourceKind.BANK_STATEMENT_EXCEL,
            total_rows=1,
            account_balances=[
                ParsedAccountBalance(
                    balance_date=date(2026, 1, 2),
                    account_name="Itau 00740-7",
                    balance_amount="37077.88",
                    source_line=21,
                    raw_payload={"0": "02/01/2026", "4": 37077.88},
                )
            ],
        )

    monkeypatch.setattr(
        "app.services.import_service.parse_excel_bank_statement",
        fake_parse_excel_bank_statement,
    )

    response = client.post(
        "/v1/imports",
        data={"source_kind": "bank_statement_excel"},
        files={
            "file": (
                "Extrato Conta Corrente.xls",
                b"fake-xls",
                "application/vnd.ms-excel",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    assert payload["valid_rows"] == 1
    assert db_session.scalar(select(func.count()).select_from(AccountBalance)) == 1

    list_response = client.get("/v1/imports", params={"source_kind": "bank_statement_excel"})
    assert list_response.status_code == 200
    assert list_response.json()["items"][0]["source_file"]["source_kind"] == "bank_statement_excel"


def test_create_import_links_credit_card_statement(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    card = CreditCard(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name="Nubank",
        issuer="Nubank",
        brand="Mastercard",
        last_four="1234",
        closing_day=23,
        due_day=30,
    )
    statement = CreditCardStatement(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        credit_card_id=card.id,
        statement_month=date(2026, 4, 1),
        due_date=date(2026, 4, 30),
        status="closed",
    )
    db_session.add_all([card, statement])
    db_session.commit()

    response = client.post(
        "/v1/imports",
        data={
            "credit_card_statement_id": statement.id,
            "source_kind": "credit_card_csv",
        },
        files={
            "file": (
                "fatura-20260430.csv",
                b"data,lan\xc3\xa7amento,valor\n2026-04-07,STUDIO Z 01/02,140.00\n",
                "text/csv",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    db_session.refresh(statement)
    assert statement.source_file_id == payload["source_file_id"]


def test_preview_import_parses_without_persisting(
    client: TestClient,
) -> None:
    response = client.post(
        "/v1/imports/preview",
        data={"source_kind": "credit_card_csv"},
        files={
            "file": (
                "preview.txt",
                b"data,lan\xc3\xa7amento,valor\n2026-05-08,PADARIA,26.06\n2026-99-08,ERRO,10.00\n",
                "text/plain",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["filename"] == "preview.txt"
    assert payload["source_kind"] == "credit_card_csv"
    assert payload["duplicate_file"] is False
    assert payload["total_rows"] == 2
    assert payload["valid_rows"] == 1
    assert payload["error_rows"] == 1
    assert payload["items"][0]["description"] == "PADARIA"
    assert payload["errors"][0]["error_code"] == "invalid_date"
    assert client.get("/v1/imports").json()["total"] == 0


def test_list_imports_filters_by_status_filename_and_paginates(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    service = ImportService(db_session)
    service.import_bytes(
        auth=auth,
        filename="extrato-janeiro.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/extrato-janeiro.txt",
        content=b"01/01/2026;PIX MERCADO;-10,00\n",
    )
    duplicate = service.import_bytes(
        auth=auth,
        filename="extrato-janeiro-copia.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/extrato-janeiro-copia.txt",
        content=b"01/01/2026;PIX MERCADO;-10,00\n",
    )
    service.import_bytes(
        auth=auth,
        filename="fatura-fevereiro.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura-fevereiro.csv",
        content=b"data,lan\xc3\xa7amento,valor\n2026-02-01,PADARIA,20.00\n",
    )

    response = client.get(
        "/v1/imports",
        params={"status": "duplicate_file", "q": "janeiro", "limit": 1, "offset": 0},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["limit"] == 1
    assert payload["offset"] == 0
    assert [item["id"] for item in payload["items"]] == [duplicate.import_job_id]
    assert payload["items"][0]["source_file"]["original_filename"] == "extrato-janeiro.txt"

    source_kind_response = client.get(
        "/v1/imports",
        params={"source_kind": "credit_card_csv"},
    )

    assert source_kind_response.status_code == 200
    source_kind_payload = source_kind_response.json()
    assert source_kind_payload["total"] == 1
    assert (
        source_kind_payload["items"][0]["source_file"]["original_filename"]
        == "fatura-fevereiro.csv"
    )


def test_list_imports_filters_jobs_with_errors(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    errored = ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura-com-erro.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura-com-erro.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2026-05-08,PADARIA,26.06\n"
        b"2026-99-08,DATA INVALIDA,10.00\n",
    )
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura-ok.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura-ok.csv",
        content=b"data,lan\xc3\xa7amento,valor\n2026-06-08,UBER,12.50\n",
    )

    response = client.get("/v1/imports", params={"has_errors": True})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert [item["id"] for item in payload["items"]] == [errored.import_job_id]
    assert payload["items"][0]["error_rows"] == 1


def test_get_import_derives_duplicate_rows_for_overlapping_file(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    service = ImportService(db_session)
    service.import_bytes(
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

    response = client.get(f"/v1/imports/{overlap.import_job_id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_rows"] == 2
    assert payload["valid_rows"] == 1
    assert payload["error_rows"] == 0
    assert payload["duplicate_rows"] == 1


def test_get_import_returns_404_for_other_workspace(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    other_auth = AuthContext(user_id=auth.user_id, workspace_id=str(uuid4()))
    result = ImportService(db_session).import_bytes(
        auth=other_auth,
        filename="outro-extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{other_auth.workspace_id}/outro-extrato.txt",
        content=b"01/07/2025;PIX OUTRO;-20,00\n",
    )

    response = client.get(f"/v1/imports/{result.import_job_id}")

    assert response.status_code == 404


def test_delete_import_removes_job_transactions_raw_lines_and_errors(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    result = ImportService(db_session).import_bytes(
        auth=auth,
        filename="extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/extrato.txt",
        content=b"01/07/2025;PIX MERCADO;-20,00\nlinha invalida\n",
    )

    response = client.delete(f"/v1/imports/{result.import_job_id}")

    assert response.status_code == 204
    assert db_session.scalar(select(func.count()).select_from(ImportJob)) == 0
    assert db_session.scalar(select(func.count()).select_from(Transaction)) == 0
    assert db_session.scalar(select(func.count()).select_from(RawTransactionLine)) == 0
    assert db_session.scalar(select(func.count()).select_from(ImportError)) == 0
    assert db_session.scalar(select(func.count()).select_from(SourceFile)) == 1


def test_list_import_errors_returns_line_errors(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    result = ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2026-05-08,PADARIA,26.06\n"
        b"2026-99-08,DATA INVALIDA,10.00\n",
    )

    response = client.get(f"/v1/imports/{result.import_job_id}/errors")

    assert response.status_code == 200
    payload = response.json()
    assert payload["workspace_id"] == auth.workspace_id
    assert payload["import_job_id"] == result.import_job_id
    assert len(payload["items"]) == 1
    assert payload["items"][0]["source_line"] == 3
    assert payload["items"][0]["field_name"] == "data"
    assert payload["items"][0]["error_code"] == "invalid_date"
