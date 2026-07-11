from collections.abc import Iterator
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth import AuthContext, get_auth_context
from app.db.models import (
    Base,
    CategorizationRule,
    Category,
    Transaction,
    TransactionCategoryAssignment,
)
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


def test_apply_trgm_memory_skips_gracefully_on_non_postgres(
    db_session: Session,
    auth: AuthContext,
) -> None:
    from app.services.categorization_service import CategorizationService

    # On SQLite (no pg_trgm) the trigram stage must skip without raising and
    # return 0, so the categorization pipeline can fall through to the LLM stage
    # instead of erroring when there is nothing/no engine to match against.
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/extrato.txt",
        content=b"01/07/2025;PIX MERCADO;-10,00\n",
    )
    applied = CategorizationService(db_session).apply_trgm_memory(auth.workspace_id)
    assert applied == 0


def test_create_and_list_rules_for_current_workspace(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    category = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Transporte")
    other_category = Category(id=str(uuid4()), workspace_id=str(uuid4()), name="Outro")
    db_session.add_all([category, other_category])
    db_session.add(
        CategorizationRule(
            id=str(uuid4()),
            workspace_id=other_category.workspace_id,
            name="Other",
            field="description",
            match_type="contains",
            pattern="OTHER",
            category_id=other_category.id,
        )
    )
    db_session.commit()

    response = client.post(
        "/v1/categorization-rules",
        json={
            "name": " Uber ",
            "field": "description",
            "match_type": "contains",
            "pattern": " UBER  TRIP ",
            "category_id": category.id,
            "priority": 10,
            "active": True,
        },
    )

    assert response.status_code == 201
    created = response.json()
    assert created["workspace_id"] == auth.workspace_id
    assert created["name"] == "Uber"
    assert created["pattern"] == "UBER TRIP"
    assert created["priority"] == 10

    list_response = client.get("/v1/categorization-rules")

    assert list_response.status_code == 200
    payload = list_response.json()
    assert payload["workspace_id"] == auth.workspace_id
    assert [item["name"] for item in payload["items"]] == ["Uber"]


def test_create_rule_requires_category_in_current_workspace_and_valid_match_options(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    current_category = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Atual")
    other_category = Category(id=str(uuid4()), workspace_id=str(uuid4()), name="Outro")
    db_session.add_all([current_category, other_category])
    db_session.commit()

    wrong_category_response = client.post(
        "/v1/categorization-rules",
        json={
            "name": "Uber",
            "field": "description",
            "match_type": "contains",
            "pattern": "UBER",
            "category_id": other_category.id,
        },
    )
    invalid_field_response = client.post(
        "/v1/categorization-rules",
        json={
            "name": "Uber",
            "field": "amount",
            "match_type": "contains",
            "pattern": "UBER",
            "category_id": current_category.id,
        },
    )

    assert wrong_category_response.status_code == 404
    assert invalid_field_response.status_code == 400


def test_update_and_delete_rule_are_scoped_by_workspace(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    category = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Transporte")
    other_category = Category(id=str(uuid4()), workspace_id=str(uuid4()), name="Outro")
    db_session.add_all([category, other_category])
    db_session.add(
        CategorizationRule(
            id=str(uuid4()),
            workspace_id=other_category.workspace_id,
            name="Other",
            field="description",
            match_type="contains",
            pattern="OTHER",
            category_id=other_category.id,
        )
    )
    db_session.commit()
    rule = client.post(
        "/v1/categorization-rules",
        json={
            "name": "Uber",
            "field": "description",
            "match_type": "contains",
            "pattern": "UBER",
            "category_id": category.id,
        },
    ).json()
    other_rule = db_session.scalars(
        select(CategorizationRule).where(CategorizationRule.workspace_id != auth.workspace_id)
    ).one()

    update_response = client.patch(
        f"/v1/categorization-rules/{rule['id']}",
        json={"match_type": "starts_with", "priority": 5, "active": False},
    )
    other_delete_response = client.delete(f"/v1/categorization-rules/{other_rule.id}")
    delete_response = client.delete(f"/v1/categorization-rules/{rule['id']}")

    assert update_response.status_code == 200
    assert update_response.json()["match_type"] == "starts_with"
    assert update_response.json()["priority"] == 5
    assert update_response.json()["active"] is False
    assert other_delete_response.status_code == 404
    assert delete_response.status_code == 204


def test_apply_rules_matches_by_priority_and_preserves_manual_assignments(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    service = ImportService(db_session)
    service.import_bytes(
        auth=auth,
        filename="fatura.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura.csv",
        content=b"data,lan\xc3\xa7amento,valor\n"
        b"2026-05-08,UBER TRIP,12.50\n"
        b"2026-05-09,UBER EATS,25.00\n"
        b"2026-05-10,PIX MERCADO,80.00\n",
    )
    transport = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Transporte")
    food = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Alimentacao")
    market = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Mercado")
    db_session.add_all([transport, food, market])
    db_session.commit()
    client.post(
        "/v1/categorization-rules",
        json={
            "name": "Uber Eats",
            "field": "description",
            "match_type": "equals",
            "pattern": "UBER EATS",
            "category_id": food.id,
            "priority": 1,
        },
    )
    client.post(
        "/v1/categorization-rules",
        json={
            "name": "Uber",
            "field": "description",
            "match_type": "starts_with",
            "pattern": "UBER",
            "category_id": transport.id,
            "priority": 10,
        },
    )
    mercado_transaction = db_session.scalars(
        select(Transaction).where(Transaction.description == "MERCADO")
    ).one()
    db_session.add(
        TransactionCategoryAssignment(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            transaction_id=mercado_transaction.id,
            category_id=market.id,
            source="manual",
            confidence=Decimal("1.0000"),
            review_status="accepted",
        )
    )
    db_session.commit()

    response = client.post("/v1/categorization-rules/apply")

    assert response.status_code == 200
    assert response.json()["workspace_id"] == auth.workspace_id
    assert response.json()["applied_count"] == 2

    assignments = {
        transaction.description: assignment
        for transaction, assignment in db_session.execute(
            select(Transaction, TransactionCategoryAssignment).join(
                TransactionCategoryAssignment,
                TransactionCategoryAssignment.transaction_id == Transaction.id,
            )
        ).all()
    }
    assert assignments["UBER TRIP"].category_id == transport.id
    assert assignments["UBER TRIP"].source == "rule"
    assert assignments["UBER EATS"].category_id == food.id
    assert assignments["UBER EATS"].source == "rule"
    assert assignments["MERCADO"].category_id == market.id
    assert assignments["MERCADO"].source == "manual"


def test_apply_rules_recategorizes_existing_non_manual_assignment(
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
        content=b"data,lan\xc3\xa7amento,valor\n2026-05-08,UBER TRIP,12.50\n",
    )
    transport = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Transporte")
    other = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Outros")
    db_session.add_all([transport, other])
    db_session.commit()
    transaction = db_session.scalars(
        select(Transaction).where(Transaction.description == "UBER TRIP")
    ).one()
    db_session.add(
        TransactionCategoryAssignment(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            transaction_id=transaction.id,
            category_id=other.id,
            source="llm",
            confidence=Decimal("0.5000"),
            review_status="pending",
        )
    )
    db_session.commit()
    client.post(
        "/v1/categorization-rules",
        json={
            "name": "Uber",
            "field": "description",
            "match_type": "starts_with",
            "pattern": "UBER",
            "category_id": transport.id,
            "priority": 1,
        },
    )

    response = client.post("/v1/categorization-rules/apply")

    assert response.status_code == 200
    assert response.json()["applied_count"] == 1
    assert response.json()["category_applied_count"] == 1
    db_session.expire_all()
    assignment = db_session.scalars(
        select(TransactionCategoryAssignment).where(
            TransactionCategoryAssignment.transaction_id == transaction.id
        )
    ).one()
    assert assignment.category_id == transport.id
    assert assignment.source == "rule"
    assert assignment.review_status == "accepted"
    assert assignment.reason == "Matched rule Uber"


def test_preview_and_apply_financial_direction_rule(
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
        content=b"01/07/2026;DEBITO CARTAO VISA;-500,00\n"
        b"02/07/2026;SUPERMERCADO;-120,00\n",
    )

    create_response = client.post(
        "/v1/categorization-rules",
        json={
            "name": "Pagamento fatura",
            "field": "description",
            "match_type": "contains",
            "pattern": "VISA",
            "target_direction": "payment",
            "priority": 1,
        },
    )
    rule = create_response.json()

    preview_response = client.get(f"/v1/categorization-rules/{rule['id']}/preview")
    apply_response = client.post("/v1/categorization-rules/apply")

    transaction = db_session.scalars(
        select(Transaction).where(Transaction.description == "DEBITO CARTAO VISA")
    ).one()

    assert create_response.status_code == 201
    assert rule["category_id"] is None
    assert rule["target_direction"] == "payment"
    assert preview_response.status_code == 200
    preview = preview_response.json()
    assert preview["total_count"] == 1
    assert preview["direction_change_count"] == 1
    assert preview["items"][0]["would_change_direction"] is True
    assert apply_response.status_code == 200
    assert apply_response.json()["applied_count"] == 1
    assert apply_response.json()["direction_applied_count"] == 1
    assert transaction.direction == "payment"


def test_rule_requires_category_or_financial_direction(
    client: TestClient,
) -> None:
    response = client.post(
        "/v1/categorization-rules",
        json={
            "name": "Sem acao",
            "field": "description",
            "match_type": "contains",
            "pattern": "FATURA",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Rule must define a category or target direction"


def test_amount_recurring_rule_matches_debit_with_positive_reference(
    db_session: Session,
    auth: AuthContext,
) -> None:
    from datetime import date

    from app.services.categorization_service import CategorizationService

    category = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Condominio")
    rule = CategorizationRule(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name="Condominio",
        field="description",
        match_type="amount_recurring",
        pattern="DDA TIT",
        category_id=category.id,
        amount_ref=Decimal("1500.00"),  # user enters a POSITIVE reference
        amount_tolerance=Decimal("500.00"),
        day_min=7,
        day_max=15,
    )
    db_session.add_all([category, rule])

    def _tx(amount: str, day: int) -> Transaction:
        return Transaction(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            source_file_id=str(uuid4()),
            import_job_id=str(uuid4()),
            source_type="bank_statement",
            transaction_date=date(2026, 7, day),
            description="DDA TIT",
            raw_description="DDA PAG TIT",
            amount=Decimal(amount),
            direction="debit",
            dedupe_key=str(uuid4()),
        )

    in_window = _tx("-1724.44", 10)  # negative debit, magnitude within ref ± tolerance
    out_of_value = _tx("-800.00", 10)  # magnitude 800 → outside 1500 ± 500
    out_of_day = _tx("-1500.00", 20)  # day 20 → outside 7..15
    db_session.add_all([in_window, out_of_value, out_of_day])
    db_session.commit()

    service = CategorizationService(db_session)
    assert service.matches(rule, in_window) is True
    assert service.matches(rule, out_of_value) is False
    assert service.matches(rule, out_of_day) is False
