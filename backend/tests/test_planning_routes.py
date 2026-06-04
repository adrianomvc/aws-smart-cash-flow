from collections.abc import Iterator
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth import AuthContext, get_auth_context
from app.db.models import Base, Budget, FinancialCalendarEvent, Goal
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


def test_calendar_events_are_scoped_to_current_workspace(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    db_session.add(
        FinancialCalendarEvent(
            id=str(uuid4()),
            workspace_id=str(uuid4()),
            title="Outro workspace",
            event_type="expense",
            amount=Decimal("10.00"),
            due_date=date(2026, 5, 10),
        )
    )
    db_session.commit()

    response = client.post(
        "/v1/calendar/events",
        json={
            "title": " Fatura Nubank ",
            "event_type": "card_payment",
            "amount": "2850.00",
            "due_date": "2026-05-15",
            "recurrence": "monthly",
        },
    )

    assert response.status_code == 201
    created = response.json()
    assert created["workspace_id"] == auth.workspace_id
    assert created["title"] == "Fatura Nubank"
    assert created["status"] == "planned"

    list_response = client.get("/v1/calendar/events?date_from=2026-05-01&date_to=2026-05-31")

    assert list_response.status_code == 200
    payload = list_response.json()
    assert payload["workspace_id"] == auth.workspace_id
    assert [item["title"] for item in payload["items"]] == ["Fatura Nubank"]


def test_budget_crud_validates_period_and_workspace_scope(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    db_session.add(
        Budget(
            id=str(uuid4()),
            workspace_id=str(uuid4()),
            name="Outro workspace",
            period_start=date(2026, 5, 1),
            period_end=date(2026, 5, 31),
            limit_amount=Decimal("100.00"),
        )
    )
    db_session.commit()

    invalid = client.post(
        "/v1/budgets",
        json={
            "name": "Mercado",
            "period_start": "2026-05-31",
            "period_end": "2026-05-01",
            "limit_amount": "1200.00",
        },
    )
    assert invalid.status_code == 400

    response = client.post(
        "/v1/budgets",
        json={
            "name": " Mercado ",
            "period_start": "2026-05-01",
            "period_end": "2026-05-31",
            "limit_amount": "1200.00",
            "alert_threshold": "0.8500",
        },
    )
    assert response.status_code == 201
    created = response.json()
    assert created["workspace_id"] == auth.workspace_id
    assert created["name"] == "Mercado"

    update = client.patch(f"/v1/budgets/{created['id']}", json={"limit_amount": "1300.00"})
    assert update.status_code == 200
    assert update.json()["limit_amount"] == "1300.00"

    list_response = client.get("/v1/budgets?date_from=2026-05-01&date_to=2026-05-31")
    assert [item["name"] for item in list_response.json()["items"]] == ["Mercado"]


def test_goal_crud_validates_amounts_and_workspace_scope(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    db_session.add(
        Goal(
            id=str(uuid4()),
            workspace_id=str(uuid4()),
            name="Outro workspace",
            target_amount=Decimal("1000.00"),
        )
    )
    db_session.commit()

    invalid = client.post(
        "/v1/goals",
        json={"name": "Reserva", "target_amount": "0", "current_amount": "0"},
    )
    assert invalid.status_code == 400

    response = client.post(
        "/v1/goals",
        json={
            "name": " Reserva de emergência ",
            "description": " Cobrir despesas essenciais ",
            "target_amount": "24000.00",
            "current_amount": "16500.00",
            "target_date": "2026-12-31",
            "priority": 10,
        },
    )
    assert response.status_code == 201
    created = response.json()
    assert created["workspace_id"] == auth.workspace_id
    assert created["name"] == "Reserva de emergência"
    assert created["description"] == "Cobrir despesas essenciais"

    update = client.patch(f"/v1/goals/{created['id']}", json={"status": "completed"})
    assert update.status_code == 200
    assert update.json()["status"] == "completed"

    list_response = client.get("/v1/goals")
    assert [item["name"] for item in list_response.json()["items"]] == [
        "Reserva de emergência"
    ]


def test_projection_endpoint_returns_horizons_and_assumptions(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    db_session.add_all(
        [
            FinancialCalendarEvent(
                id=str(uuid4()),
                workspace_id=auth.workspace_id,
                title="Salario",
                event_type="income",
                amount=Decimal("5000.00"),
                due_date=date(2026, 6, 5),
            ),
            FinancialCalendarEvent(
                id=str(uuid4()),
                workspace_id=auth.workspace_id,
                title="Aluguel",
                event_type="expense",
                amount=Decimal("2100.00"),
                due_date=date(2026, 6, 10),
            ),
        ]
    )
    db_session.commit()

    response = client.get("/v1/planning/projection?date_from=2026-06-01&horizons=30,60")

    assert response.status_code == 200
    payload = response.json()
    assert payload["workspace_id"] == auth.workspace_id
    assert [item["days"] for item in payload["horizons"]] == [30, 60]
    assert payload["horizons"][0]["projected_balance"] == "2900.00"
    assert payload["assumptions"]
