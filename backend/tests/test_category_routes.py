from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth import AuthContext, get_auth_context
from app.db.models import Base, CategorizationRule, Category
from app.db.session import get_db
from app.main import create_app


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


def test_create_and_list_categories_for_current_workspace(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    other_category = Category(id=str(uuid4()), workspace_id=str(uuid4()), name="Transporte")
    db_session.add(other_category)
    db_session.commit()

    response = client.post("/v1/categories", json={"name": " Transporte "})

    assert response.status_code == 201
    created = response.json()
    assert created["workspace_id"] == auth.workspace_id
    assert created["name"] == "Transporte"
    assert created["parent_category_id"] is None

    list_response = client.get("/v1/categories")

    assert list_response.status_code == 200
    payload = list_response.json()
    assert payload["workspace_id"] == auth.workspace_id
    assert [item["name"] for item in payload["items"]] == ["Transporte"]


def test_create_category_rejects_duplicate_name_in_same_workspace(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    other_workspace_category = Category(
        id=str(uuid4()),
        workspace_id=str(uuid4()),
        name="Casa",
    )
    db_session.add(other_workspace_category)
    db_session.commit()

    first = client.post("/v1/categories", json={"name": "Casa"})
    duplicate = client.post("/v1/categories", json={"name": "Casa"})

    assert first.status_code == 201
    assert duplicate.status_code == 409


def test_create_category_requires_parent_in_current_workspace(
    client: TestClient,
    db_session: Session,
) -> None:
    other_parent = Category(id=str(uuid4()), workspace_id=str(uuid4()), name="Outro")
    db_session.add(other_parent)
    db_session.commit()

    response = client.post(
        "/v1/categories",
        json={"name": "Filha", "parent_category_id": other_parent.id},
    )

    assert response.status_code == 404


def test_update_category_changes_name_clears_parent_and_rejects_cycles(
    client: TestClient,
) -> None:
    parent = client.post("/v1/categories", json={"name": "Casa"}).json()
    child = client.post(
        "/v1/categories",
        json={"name": "Mercado", "parent_category_id": parent["id"]},
    ).json()

    cycle_response = client.patch(
        f"/v1/categories/{parent['id']}",
        json={"parent_category_id": child["id"]},
    )
    update_response = client.patch(
        f"/v1/categories/{child['id']}",
        json={"name": "Supermercado", "parent_category_id": None},
    )

    assert cycle_response.status_code == 400
    assert update_response.status_code == 200
    payload = update_response.json()
    assert payload["name"] == "Supermercado"
    assert payload["parent_category_id"] is None


def test_delete_category_returns_404_for_other_workspace_and_blocks_used_categories(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    category = client.post("/v1/categories", json={"name": "Transporte"}).json()
    other_workspace_category = Category(
        id=str(uuid4()),
        workspace_id=str(uuid4()),
        name="Outro",
    )
    db_session.add(other_workspace_category)
    db_session.add(
        CategorizationRule(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            name="Uber",
            field="description",
            match_type="contains",
            pattern="UBER",
            category_id=category["id"],
        )
    )
    db_session.commit()

    other_response = client.delete(f"/v1/categories/{other_workspace_category.id}")
    used_response = client.delete(f"/v1/categories/{category['id']}")

    assert other_response.status_code == 404
    assert used_response.status_code == 409


def test_delete_category_removes_unused_category(
    client: TestClient,
    db_session: Session,
) -> None:
    category = client.post("/v1/categories", json={"name": "Saude"}).json()

    response = client.delete(f"/v1/categories/{category['id']}")

    assert response.status_code == 204
    assert db_session.scalar(select(Category).where(Category.id == category["id"])) is None
