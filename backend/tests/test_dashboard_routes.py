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
    assert payload["expenses"] == "1525.50"
    assert payload["payments"] == "800.00"
    assert payload["balance"] == "3474.50"
    assert payload["savings_rate"] == "0.6949"
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
    assert payload["items"][0]["expenses"] == "1525.50"
    assert payload["items"][0]["payments"] == "800.00"
    assert payload["items"][0]["balance"] == "3474.50"
    assert payload["items"][1]["expenses"] == "40.00"


def test_dashboard_credit_card_payment_matches_suggests_same_amount_nearby(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/extrato.txt",
        content=b"03/05/2026;PAGAMENTO FATURA;-800,00\n"
        b"10/05/2026;PAGAMENTO FATURA;-120,00\n",
    )
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2026-05-01,PAGAMENTO EFETUADO,-800.00\n"
        b"2026-05-01,PAGAMENTO EFETUADO,-999.00\n",
    )

    response = client.get(
        "/v1/dashboard/credit-card-payment-matches?date_from=2026-05-01&date_to=2026-05-31&window_days=7"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["workspace_id"] == auth.workspace_id
    assert len(payload["items"]) == 1
    assert payload["items"][0]["amount"] == "800.00"
    assert payload["items"][0]["bank_date"] == "2026-05-03"
    assert payload["items"][0]["card_date"] == "2026-05-01"
    assert payload["items"][0]["date_delta_days"] == 2
    assert payload["items"][0]["bank_description"] == "PAGAMENTO FATURA"
    assert payload["items"][0]["card_description"] == "PAGAMENTO EFETUADO"


def test_dashboard_weekday_spending_groups_debits_only(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2026-05-04,PADARIA,40.00\n"
        b"2026-05-11,IFOOD,60.00\n"
        b"2026-05-12,UBER,25.00\n",
    )
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/extrato.txt",
        content=b"04/05/2026;SALARIO;5000,00\n04/05/2026;PAGAMENTO FATURA;-100,00\n",
    )

    response = client.get("/v1/dashboard/weekday-spending?date_from=2026-05-01&date_to=2026-05-31")

    assert response.status_code == 200
    payload = response.json()
    monday = payload["items"][0]
    tuesday = payload["items"][1]
    assert monday["weekday_name"] == "Segunda"
    assert monday["amount"] == "100.00"
    assert monday["count"] == 2
    assert monday["average_amount"] == "50.00"
    assert monday["share_ratio"] == "0.8000"
    assert tuesday["amount"] == "25.00"
    assert tuesday["count"] == 1


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
    assert payload["items"][0]["amount"] == "1500.00"
    assert payload["items"][0]["count"] == 1
    assert payload["items"][0]["share_ratio"] == "0.9833"
    assert payload["items"][0]["average_amount"] == "1500.00"
    assert payload["items"][1]["category_name"] == "Transporte"
    assert payload["items"][1]["amount"] == "25.50"
    assert payload["items"][1]["share_ratio"] == "0.0167"
    assert payload["items"][1]["average_amount"] == "25.50"


def test_dashboard_category_ranking_groups_subcategories_by_parent(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura.csv",
        content=b"data,lan\xc3\xa7amento,valor\n2026-05-04,IFOOD,25.50\n",
    )
    parent_id = client.post("/v1/categories", json={"name": "Alimentacao"}).json()["id"]
    child_id = client.post(
        "/v1/categories",
        json={"name": "Delivery", "parent_category_id": parent_id},
    ).json()["id"]
    tx_id = client.get("/v1/transactions?q=ifood").json()["items"][0]["id"]
    client.patch(f"/v1/transactions/{tx_id}/category", json={"category_id": child_id})

    response = client.get("/v1/dashboard/category-ranking?date_from=2026-05-01&date_to=2026-05-31")

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["category_id"] == parent_id
    assert payload["items"][0]["category_name"] == "Alimentacao"
    assert payload["items"][0]["amount"] == "25.50"


def test_dashboard_merchant_ranking_groups_by_normalized_description(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2026-05-04,MERCADOLIVRE*LOJA EXEMPLO,25.50\n"
        b"2026-05-05,MERCADOLIVRE*MERCADO LIVRE LOJA EXEMPLO,10.00\n"
        b"2026-05-06,SHELL*POSTO EXEMPLO,80.00\n"
        b"2026-05-07,PAGAMENTO EFETUADO,-80.00\n",
    )

    response = client.get("/v1/dashboard/merchant-ranking?date_from=2026-05-01&date_to=2026-05-31")

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0] == {
        "description": "SHELL POSTO EXEMPLO",
        "amount": "80.00",
        "count": 1,
    }
    assert payload["items"][1] == {
        "description": "MERCADO LIVRE",
        "amount": "35.50",
        "count": 2,
    }


def test_dashboard_category_growth_alerts_compare_previous_period(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2026-04-05,IFOOD ABRIL,100.00\n"
        b"2026-05-05,IFOOD MAIO,250.00\n"
        b"2026-04-06,UBER ABRIL,90.00\n"
        b"2026-05-06,UBER MAIO,110.00\n",
    )
    alimentacao_id = client.post("/v1/categories", json={"name": "Alimentacao"}).json()["id"]
    transporte_id = client.post("/v1/categories", json={"name": "Transporte"}).json()["id"]
    for query, category_id in (("ifood", alimentacao_id), ("uber", transporte_id)):
        for transaction in client.get(f"/v1/transactions?q={query}").json()["items"]:
            client.patch(f"/v1/transactions/{transaction['id']}/category", json={"category_id": category_id})

    response = client.get(
        "/v1/dashboard/category-growth-alerts?date_from=2026-05-01&date_to=2026-05-31&limit=3"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"] == [
        {
            "category_id": alimentacao_id,
            "category_name": "Alimentacao",
            "current_amount": "250.00",
            "previous_amount": "100.00",
            "change_amount": "150.00",
            "change_ratio": "1.5000",
            "current_count": 1,
            "previous_count": 1,
            "previous_date_from": "2026-03-31",
            "previous_date_to": "2026-04-30",
        }
    ]


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
