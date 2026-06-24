from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import auth as auth_module
from app.db.models import Base, User, Workspace, WorkspaceMember
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
def client(db_session: Session) -> Iterator[TestClient]:
    app = create_app()

    def override_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_current_workspace_creates_initial_user_workspace_and_membership(
    client: TestClient,
    db_session: Session,
) -> None:
    response = client.get("/v1/workspaces/current", headers={"Authorization": "Bearer local-dev"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == auth_module.LOCAL_USER_ID
    assert payload["workspace_id"] == auth_module.LOCAL_WORKSPACE_ID
    assert payload["workspace_name"] == "Local workspace"
    assert payload["role"] == "owner"
    assert db_session.scalar(select(func.count()).select_from(User)) == 1
    assert db_session.scalar(select(func.count()).select_from(Workspace)) == 1
    assert db_session.scalar(select(func.count()).select_from(WorkspaceMember)) == 1


def test_current_workspace_reuses_existing_membership(
    client: TestClient,
    db_session: Session,
) -> None:
    for _ in range(2):
        response = client.get(
            "/v1/workspaces/current",
            headers={"Authorization": "Bearer local-dev"},
        )
        assert response.status_code == 200

    assert db_session.scalar(select(func.count()).select_from(User)) == 1
    assert db_session.scalar(select(func.count()).select_from(Workspace)) == 1
    assert db_session.scalar(select(func.count()).select_from(WorkspaceMember)) == 1


def test_current_workspace_accepts_supabase_jwt_when_secret_is_configured(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    secret = "test-secret"
    user_id = str(uuid4())
    monkeypatch.setattr(auth_module.settings, "supabase_jwt_secret", secret)
    token = jwt.encode(
        {"sub": user_id, "email": "user@example.com", "aud": "authenticated"},
        secret,
        algorithm="HS256",
    )

    response = client.get(
        "/v1/workspaces/current",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == user_id
    assert payload["role"] == "owner"

    user = db_session.scalar(select(User).where(User.supabase_user_id == user_id))
    assert user is not None
    assert user.email == "user@example.com"


def test_current_workspace_rejects_invalid_supabase_jwt_when_secret_is_configured(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth_module.settings, "supabase_jwt_secret", "test-secret")

    response = client.get(
        "/v1/workspaces/current",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert response.status_code == 401


def test_current_workspace_rejects_local_demo_when_enabled_outside_local_env(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth_module.settings, "app_env", "main")
    monkeypatch.setattr(auth_module.settings, "allow_local_auth", True)
    monkeypatch.setattr(auth_module.settings, "supabase_jwt_secret", "")

    response = client.get("/v1/workspaces/current", headers={"Authorization": "Bearer local-dev"})

    assert response.status_code == 403


def test_current_workspace_rejects_local_demo_when_disabled_outside_local_env(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth_module.settings, "app_env", "main")
    monkeypatch.setattr(auth_module.settings, "allow_local_auth", False)
    monkeypatch.setattr(auth_module.settings, "supabase_jwt_secret", "")

    response = client.get("/v1/workspaces/current", headers={"Authorization": "Bearer local-dev"})

    assert response.status_code == 401


def test_rename_workspace_returns_updated_workspace(client: TestClient) -> None:
    # Ensure the workspace exists first.
    client.get("/v1/workspaces/current", headers={"Authorization": "Bearer local-dev"})

    response = client.patch(
        "/v1/workspaces/current",
        headers={"Authorization": "Bearer local-dev"},
        json={"name": "Família Costa"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["workspace_name"] == "Família Costa"
    assert "has_transactions" in payload  # response includes the full current-workspace shape

    # The new name persists on the next read.
    after = client.get("/v1/workspaces/current", headers={"Authorization": "Bearer local-dev"})
    assert after.json()["workspace_name"] == "Família Costa"


def test_list_workspaces_returns_the_users_workspaces(client: TestClient) -> None:
    # Ensure the local workspace/membership exist.
    client.get("/v1/workspaces/current", headers={"Authorization": "Bearer local-dev"})

    response = client.get("/v1/workspaces", headers={"Authorization": "Bearer local-dev"})

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) >= 1
    assert any(i["role"] == "owner" for i in items)


def test_x_workspace_id_header_is_ignored_when_not_a_member(client: TestClient) -> None:
    client.get("/v1/workspaces/current", headers={"Authorization": "Bearer local-dev"})
    # A workspace the local user is NOT a member of must not be honored.
    response = client.get(
        "/v1/workspaces/current",
        headers={"Authorization": "Bearer local-dev", "X-Workspace-Id": str(uuid4())},
    )
    assert response.status_code == 200
    assert response.json()["workspace_id"] == auth_module.LOCAL_WORKSPACE_ID
