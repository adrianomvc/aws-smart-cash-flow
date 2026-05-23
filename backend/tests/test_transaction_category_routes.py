from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth import AuthContext, get_auth_context
from app.db.models import Base, TransactionCategoryAssignment
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


def import_sample_transactions(db_session: Session, auth: AuthContext) -> None:
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2026-05-08,99APP       *99App,26.06\n"
        b"2026-05-09,PADARIA SAO JOSE,14.90\n",
    )


def test_list_transactions_returns_workspace_transactions_with_filters(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    import_sample_transactions(db_session=db_session, auth=auth)
    ImportService(db_session).import_bytes(
        auth=AuthContext(user_id=auth.user_id, workspace_id=str(uuid4())),
        filename="outro.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path="other/outro.csv",
        content=b"data,lan\xc3\xa7amento,valor\n2026-05-08,OUTRA COMPRA,99.99\n",
    )

    response = client.get("/v1/transactions?q=99app&date_from=2026-05-01&date_to=2026-05-31")

    assert response.status_code == 200
    payload = response.json()
    assert payload["workspace_id"] == auth.workspace_id
    assert [item["description"] for item in payload["items"]] == ["99APP"]
    assert payload["items"][0]["amount"] == "26.06"
    assert payload["items"][0]["category"] is None


def test_list_transactions_filters_by_direction(
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
        content=b"01/05/2026;SALARIO;5.000,00\n02/05/2026;MERCADO;-123,45\n",
    )

    response = client.get("/v1/transactions?direction=credit")

    assert response.status_code == 200
    assert [item["description"] for item in response.json()["items"]] == ["SALARIO"]


def test_list_transactions_defaults_to_latest_transaction_date(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    import_sample_transactions(db_session=db_session, auth=auth)

    response = client.get("/v1/transactions")

    assert response.status_code == 200
    assert [item["description"] for item in response.json()["items"]] == [
        "PADARIA SAO JOSE",
        "99APP",
    ]


def test_list_transactions_supports_sorting(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    import_sample_transactions(db_session=db_session, auth=auth)

    response = client.get("/v1/transactions?sort_by=amount&sort_dir=asc")

    assert response.status_code == 200
    assert [item["description"] for item in response.json()["items"]] == [
        "PADARIA SAO JOSE",
        "99APP",
    ]


def test_list_transactions_rejects_invalid_sort(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    import_sample_transactions(db_session=db_session, auth=auth)

    invalid_field = client.get("/v1/transactions?sort_by=created_at")
    invalid_direction = client.get("/v1/transactions?sort_dir=sideways")

    assert invalid_field.status_code == 400
    assert invalid_direction.status_code == 400


def test_update_transaction_category_creates_manual_assignment(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    import_sample_transactions(db_session=db_session, auth=auth)
    category_id = client.post("/v1/categories", json={"name": "Transporte"}).json()["id"]
    transaction_id = client.get("/v1/transactions?q=99app").json()["items"][0]["id"]

    response = client.patch(
        f"/v1/transactions/{transaction_id}/category",
        json={"category_id": category_id},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["category"]["category_id"] == category_id
    assert payload["category"]["source"] == "manual"

    assignment = db_session.scalars(select(TransactionCategoryAssignment)).one()
    assert assignment.workspace_id == auth.workspace_id
    assert assignment.transaction_id == transaction_id
    assert assignment.category_id == category_id
    assert assignment.source == "manual"


def test_categories_support_parent_and_clear_parent(client: TestClient) -> None:
    parent_id = client.post("/v1/categories", json={"name": "Alimentacao"}).json()["id"]
    other_parent_id = client.post("/v1/categories", json={"name": "Transporte"}).json()["id"]

    child_response = client.post(
        "/v1/categories",
        json={"name": "Restaurantes", "parent_category_id": parent_id},
    )
    same_name_other_parent = client.post(
        "/v1/categories",
        json={"name": "Restaurantes", "parent_category_id": other_parent_id},
    )

    assert child_response.status_code == 201
    assert same_name_other_parent.status_code == 201
    child = child_response.json()
    assert child["parent_category_id"] == parent_id

    clear_response = client.patch(
        f"/v1/categories/{child['id']}",
        json={"name": "Restaurantes", "parent_category_id": None},
    )

    assert clear_response.status_code == 200
    assert clear_response.json()["parent_category_id"] is None


def test_categories_reject_duplicate_name_under_same_parent(client: TestClient) -> None:
    parent_id = client.post("/v1/categories", json={"name": "Alimentacao"}).json()["id"]

    client.post("/v1/categories", json={"name": "Delivery", "parent_category_id": parent_id})
    duplicate = client.post(
        "/v1/categories",
        json={"name": "Delivery", "parent_category_id": parent_id},
    )
    root_duplicate = client.post("/v1/categories", json={"name": "Alimentacao"})

    assert duplicate.status_code == 409
    assert root_duplicate.status_code == 409


def test_categories_are_listed_as_ordered_tree(client: TestClient) -> None:
    transporte_id = client.post("/v1/categories", json={"name": "Transporte"}).json()["id"]
    alimentacao_id = client.post("/v1/categories", json={"name": "Alimentacao"}).json()["id"]
    client.post("/v1/categories", json={"name": "Uber", "parent_category_id": transporte_id})
    client.post("/v1/categories", json={"name": "Delivery", "parent_category_id": alimentacao_id})
    client.post("/v1/categories", json={"name": "Mercado", "parent_category_id": alimentacao_id})

    response = client.get("/v1/categories")

    assert response.status_code == 200
    assert [item["name"] for item in response.json()["items"]] == [
        "Alimentacao",
        "Delivery",
        "Mercado",
        "Transporte",
        "Uber",
    ]


def test_rule_application_categorizes_matching_transactions(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    import_sample_transactions(db_session=db_session, auth=auth)
    category_id = client.post("/v1/categories", json={"name": "Transporte"}).json()["id"]
    rule_response = client.post(
        "/v1/categorization-rules",
        json={
            "name": "99App",
            "field": "description",
            "match_type": "contains",
            "pattern": "99app",
            "category_id": category_id,
            "priority": 10,
            "active": True,
        },
    )

    apply_response = client.post("/v1/categorization-rules/apply")
    transaction_response = client.get(f"/v1/transactions?category_id={category_id}")

    assert rule_response.status_code == 201
    assert apply_response.status_code == 200
    assert apply_response.json()["applied_count"] == 1
    assert [item["description"] for item in transaction_response.json()["items"]] == [
        "99APP"
    ]
    assert transaction_response.json()["items"][0]["category"]["source"] == "rule"


def test_rule_application_preserves_manual_category(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    import_sample_transactions(db_session=db_session, auth=auth)
    manual_category_id = client.post("/v1/categories", json={"name": "Apps"}).json()["id"]
    rule_category_id = client.post("/v1/categories", json={"name": "Transporte"}).json()["id"]
    transaction_id = client.get("/v1/transactions?q=99app").json()["items"][0]["id"]
    client.patch(
        f"/v1/transactions/{transaction_id}/category",
        json={"category_id": manual_category_id},
    )
    client.post(
        "/v1/categorization-rules",
        json={
            "name": "99App",
            "field": "description",
            "match_type": "contains",
            "pattern": "99app",
            "category_id": rule_category_id,
            "priority": 10,
            "active": True,
        },
    )

    response = client.post("/v1/categorization-rules/apply")
    transaction = client.get("/v1/transactions?q=99app").json()["items"][0]

    assert response.status_code == 200
    assert response.json()["applied_count"] == 0
    assert transaction["category"]["category_id"] == manual_category_id
    assert transaction["category"]["source"] == "manual"
