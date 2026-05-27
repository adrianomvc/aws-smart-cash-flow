from collections.abc import Iterator
from datetime import date
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
from app.services.dashboard_service import (
    get_first_invoice_month,
    get_installment_for_target_month,
)
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


def test_credit_card_installment_projection_respects_closing_day() -> None:
    assert get_first_invoice_month(date(2026, 2, 24), closing_day=23) == date(2026, 3, 1)
    assert (
        get_installment_for_target_month(
            date(2026, 2, 24),
            total_installments=10,
            target_year=2026,
            target_month=3,
            closing_day=23,
        )
        == 1
    )
    assert (
        get_installment_for_target_month(
            date(2026, 2, 24),
            total_installments=10,
            target_year=2026,
            target_month=4,
            closing_day=23,
        )
        == 2
    )
    assert (
        get_installment_for_target_month(
            date(2026, 2, 24),
            total_installments=10,
            target_year=2026,
            target_month=5,
            closing_day=23,
        )
        == 3
    )
    assert (
        get_installment_for_target_month(
            date(2026, 1, 29),
            total_installments=4,
            target_year=2026,
            target_month=5,
            closing_day=23,
        )
        == 4
    )
    assert (
        get_installment_for_target_month(
            date(2026, 4, 7),
            total_installments=2,
            target_year=2026,
            target_month=4,
            closing_day=23,
        )
        == 1
    )


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
    assert payload["commitment_rate"] == "0.3051"
    assert payload["burn_rate"] == "1525.50"
    assert payload["burn_rate_months"] == 1
    assert payload["burn_rate_basis"] == "trailing_12_month_average"
    assert payload["transaction_count"] == 4


def test_dashboard_summary_burn_rate_uses_trailing_12_months(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    seed_dashboard_data(client=client, db_session=db_session, auth=auth)
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="extrato-anterior.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/extrato-anterior.txt",
        content=b"15/04/2026;MERCADO;-1000,00\n",
    )

    response = client.get("/v1/dashboard/summary?date_from=2026-05-01&date_to=2026-05-31")

    assert response.status_code == 200
    payload = response.json()
    assert payload["expenses"] == "1525.50"
    assert payload["burn_rate"] == "1262.75"
    assert payload["burn_rate_months"] == 2
    assert payload["burn_rate_basis"] == "trailing_12_month_average"


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


def test_dashboard_credit_card_installments_projects_future_month_from_invoice_month(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura-20260120.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura-20260120.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2026-01-29,BALACOBACO FESTA  01/04,921.49\n",
    )
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura-20260320.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura-20260320.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2026-01-29,BALACOBACO FESTA  03/04,921.49\n",
    )
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura-20250120.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura-20250120.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2025-01-13,ANGLO  10/11,5930.97\n",
    )

    response = client.get("/v1/dashboard/credit-card-installments?date_to=2026-03-31")

    assert response.status_code == 200
    payload = response.json()
    assert payload["workspace_id"] == auth.workspace_id
    assert payload["active_count"] == 1
    assert payload["closing_day"] == 23
    assert payload["due_day"] == 30
    assert payload["total_future_amount"] == "921.49"
    assert len(payload["items"]) == 1
    assert payload["items"][0]["description"] == "BALACOBACO FESTA"
    assert payload["items"][0]["installment_current"] == 3
    assert payload["items"][0]["installment_total"] == 4
    assert payload["items"][0]["remaining_installments"] == 1
    assert payload["items"][0]["future_amount"] == "921.49"
    assert payload["items"][0]["first_invoice_month"] == "2026-02-01"


def test_dashboard_credit_card_installments_projects_filtered_month_from_invoice_month(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura-20260420.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura-20260420.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2026-02-24,ANGLO 01/10,6536.76\n"
        b"2026-01-29,BALACOBACO FESTA 01/04,921.49\n"
        b"2026-02-21,DR REBECCA 01/03,333.34\n"
        b"2026-01-22,MERCADO PAGO 01/03,100.00\n"
        b"2026-01-31,MORUMBI KIDS 01/03,200.00\n"
        b"2026-01-20,NOVA CANTINA 01/11,781.19\n"
        b"2026-04-07,STUDIO Z 01/02,140.00\n",
    )

    response = client.get(
        "/v1/dashboard/credit-card-installments?date_from=2026-04-01&date_to=2026-04-30"
    )

    assert response.status_code == 200
    payload = response.json()
    items_by_description = {item["description"]: item for item in payload["items"]}
    assert payload["active_count"] == 6
    assert payload["closing_day"] == 23
    assert payload["due_day"] == 30
    assert payload["total_future_amount"] == "8912.78"
    assert items_by_description["ANGLO"]["installment_current"] == 2
    assert items_by_description["ANGLO"]["installment_total"] == 10
    assert items_by_description["ANGLO"]["first_invoice_month"] == "2026-03-01"
    assert items_by_description["BALACOBACO FESTA"]["installment_current"] == 3
    assert items_by_description["BALACOBACO FESTA"]["installment_total"] == 4
    assert items_by_description["BALACOBACO FESTA"]["first_invoice_month"] == "2026-02-01"
    assert items_by_description["DR REBECCA"]["installment_current"] == 3
    assert items_by_description["DR REBECCA"]["installment_total"] == 3
    assert items_by_description["MORUMBI KIDS"]["installment_current"] == 3
    assert items_by_description["MORUMBI KIDS"]["installment_total"] == 3
    assert items_by_description["NOVA CANTINA"]["installment_current"] == 4
    assert items_by_description["NOVA CANTINA"]["installment_total"] == 11
    assert items_by_description["STUDIO Z"]["installment_current"] == 1
    assert items_by_description["STUDIO Z"]["installment_total"] == 2
    assert "MERCADO PAGO" not in items_by_description


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


def test_dashboard_recurring_expenses_detects_probable_monthly_costs(
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
        b"2026-01-05,NETFLIX,39.90\n"
        b"2026-02-05,NETFLIX,39.90\n"
        b"2026-03-05,NETFLIX,49.90\n"
        b"2026-03-06,RESTAURANTE,120.00\n",
    )
    category_id = client.post("/v1/categories", json={"name": "Assinaturas"}).json()["id"]
    for transaction in client.get("/v1/transactions?q=netflix").json()["items"]:
        client.patch(
            f"/v1/transactions/{transaction['id']}/category",
            json={"category_id": category_id},
        )

    response = client.get(
        "/v1/dashboard/recurring-expenses?date_from=2026-01-01&date_to=2026-03-31"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"] == [
        {
            "description": "NETFLIX",
            "category_id": category_id,
            "category_name": "Assinaturas",
            "average_amount": "43.23",
            "last_amount": "49.90",
            "transaction_count": 3,
            "month_count": 3,
            "last_transaction_date": "2026-03-05",
            "change_ratio": "0.1543",
            "status": "probable",
        }
    ]


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
            client.patch(
                f"/v1/transactions/{transaction['id']}/category",
                json={"category_id": category_id},
            )

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
