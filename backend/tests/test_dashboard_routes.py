from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth import AuthContext, get_auth_context
from app.db.models import Base
from app.db.session import get_db
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


def seed_dashboard_data(client: TestClient, db_session: Session, auth: AuthContext) -> None:
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/extrato.txt",
        content=b"01/05/2026;SALARIO;5000,00\n"
        b"02/05/2026;ALUGUEL;-1500,00\n"
        b"03/05/2026;PAGAMENTO FATURA;-800,00\n",
    )
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2026-05-04,99APP,25.50\n"
        b"2026-06-05,PADARIA,40.00\n",
    )
    transporte_id = client.post("/v1/categories", json={"name": "Transporte"}).json()["id"]
    tx_id = client.get("/v1/transactions?q=99app").json()["items"][0]["id"]
    client.patch(f"/v1/transactions/{tx_id}/category", json={"category_id": transporte_id})


def test_dashboard_summary_calculates_period_totals(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    seed_dashboard_data(client=client, db_session=db_session, auth=auth)
    ImportService(db_session).import_bytes(
        auth=AuthContext(user_id=auth.user_id, workspace_id=str(uuid4())),
        filename="outro.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path="other/outro.txt",
        content=b"01/05/2026;SALARIO OUTRO;9999,00\n",
    )

    response = client.get("/v1/dashboard/summary?date_from=2026-05-01&date_to=2026-05-31")

    assert response.status_code == 200
    payload = response.json()
    assert payload["workspace_id"] == auth.workspace_id
    assert payload["income"] == "5000.00"
    assert payload["expenses"] == "2325.50"
    assert payload["payments"] == "0.00"
    assert payload["balance"] == "2674.50"
    assert payload["savings_rate"] == "0.5349"
    assert payload["transaction_count"] == 4


def test_dashboard_monthly_cashflow_groups_by_month(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    seed_dashboard_data(client=client, db_session=db_session, auth=auth)

    response = client.get("/v1/dashboard/monthly-cashflow")

    assert response.status_code == 200
    payload = response.json()
    assert [item["month"] for item in payload["items"]] == ["2026-05", "2026-06"]
    assert payload["items"][0]["income"] == "5000.00"
    assert payload["items"][0]["expenses"] == "2325.50"
    assert payload["items"][0]["balance"] == "2674.50"
    assert payload["items"][1]["expenses"] == "40.00"


def test_dashboard_category_ranking_groups_uncategorized_expenses(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    seed_dashboard_data(client=client, db_session=db_session, auth=auth)

    response = client.get("/v1/dashboard/category-ranking?date_from=2026-05-01&date_to=2026-05-31")

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["category_name"] == "Sem categoria"
    assert payload["items"][0]["amount"] == "2300.00"
    assert payload["items"][0]["count"] == 2
    assert payload["items"][1]["category_name"] == "Transporte"
    assert payload["items"][1]["amount"] == "25.50"


def test_dashboard_data_quality_counts_categories_and_import_issues(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    seed_dashboard_data(client=client, db_session=db_session, auth=auth)
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura-com-erro.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura-com-erro.csv",
        content=b"data,lan\xc3\xa7amento,valor\n2026-99-04,DATA INVALIDA,25.50\n",
    )
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura-com-erro.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/duplicado.csv",
        content=b"data,lan\xc3\xa7amento,valor\n2026-99-04,DATA INVALIDA,25.50\n",
    )

    response = client.get("/v1/dashboard/data-quality")

    assert response.status_code == 200
    payload = response.json()
    assert payload["transaction_count"] == 5
    assert payload["categorized_count"] == 1
    assert payload["uncategorized_count"] == 4
    assert payload["categorized_ratio"] == "0.2000"
    assert payload["imports_with_errors"] == 1
    assert payload["duplicate_imports"] == 1
