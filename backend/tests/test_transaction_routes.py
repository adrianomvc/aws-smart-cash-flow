from collections.abc import Iterator
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth import AuthContext, get_auth_context
from app.db.models import Base, Category, Transaction, TransactionCategoryAssignment
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


def test_list_transactions_returns_current_workspace_transactions(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    service = ImportService(db_session)
    service.import_bytes(
        auth=auth,
        filename="extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/extrato.txt",
        content=b"01/07/2025;PIX MERCADO;-10,00\n02/07/2025;SALARIO;100,00\n",
    )
    other_auth = AuthContext(user_id=auth.user_id, workspace_id=str(uuid4()))
    service.import_bytes(
        auth=other_auth,
        filename="outro-extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{other_auth.workspace_id}/outro-extrato.txt",
        content=b"03/07/2025;PIX OUTRO;-20,00\n",
    )

    response = client.get("/v1/transactions")

    assert response.status_code == 200
    payload = response.json()
    assert payload["workspace_id"] == auth.workspace_id
    assert [item["description"] for item in payload["items"]] == ["SALARIO", "PIX MERCADO"]
    assert payload["items"][0]["amount"] == "100.00"
    assert payload["items"][0]["direction"] == "credit"


def test_list_transactions_filters_by_date_source_and_query(
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
        b"2026-05-08,PADARIA,26.06\n"
        b"2026-05-09,UBER,12.50\n"
        b"2026-06-01,MERCADO,80.00\n",
    )

    response = client.get(
        "/v1/transactions",
        params={
            "date_from": "2026-05-01",
            "date_to": "2026-05-31",
            "source_type": "credit_card_statement",
            "q": "pad",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert [item["description"] for item in payload["items"]] == ["PADARIA"]


def test_list_transactions_filters_by_category_and_paginates(
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
        b"2026-05-08,PADARIA,26.06\n"
        b"2026-05-09,UBER,12.50\n",
    )
    category = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Transporte")
    db_session.add(category)
    uber = db_session.scalars(select(Transaction).where(Transaction.description == "UBER")).one()
    db_session.add(
        TransactionCategoryAssignment(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            transaction_id=uber.id,
            category_id=category.id,
            source="manual",
            confidence=Decimal("1.0000"),
            review_status="accepted",
        )
    )
    db_session.commit()

    response = client.get(
        "/v1/transactions",
        params={"category_id": category.id, "limit": 1, "offset": 0},
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["items"]) == 1
    assert payload["items"][0]["description"] == "UBER"
    assert payload["items"][0]["category_id"] == category.id
    assert payload["items"][0]["category_source"] == "manual"
    assert payload["items"][0]["category_review_status"] == "accepted"


def test_update_transaction_category_creates_manual_assignment(
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
        content=b"data,lan\xc3\xa7amento,valor\n2026-05-08,PADARIA,26.06\n",
    )
    transaction = db_session.scalars(select(Transaction)).one()
    category = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Alimentacao")
    db_session.add(category)
    db_session.commit()

    response = client.patch(
        f"/v1/transactions/{transaction.id}/category",
        json={"category_id": category.id},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == transaction.id
    assert payload["category_id"] == category.id
    assert payload["category_source"] == "manual"
    assert payload["category_review_status"] == "accepted"

    assignment = db_session.scalars(select(TransactionCategoryAssignment)).one()
    assert assignment.workspace_id == auth.workspace_id
    assert assignment.transaction_id == transaction.id
    assert assignment.category_id == category.id
    assert assignment.source == "manual"
    assert assignment.confidence == Decimal("1.0000")
    assert assignment.review_status == "accepted"


def test_update_transaction_category_replaces_existing_assignment_with_manual(
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
        content=b"data,lan\xc3\xa7amento,valor\n2026-05-08,UBER,12.50\n",
    )
    transaction = db_session.scalars(select(Transaction)).one()
    old_category = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Antiga")
    new_category = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Transporte")
    db_session.add_all([old_category, new_category])
    db_session.add(
        TransactionCategoryAssignment(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            transaction_id=transaction.id,
            category_id=old_category.id,
            source="rule",
            confidence=Decimal("1.0000"),
            review_status="accepted",
        )
    )
    db_session.commit()

    response = client.patch(
        f"/v1/transactions/{transaction.id}/category",
        json={"category_id": new_category.id},
    )

    assert response.status_code == 200
    assignment = db_session.scalars(select(TransactionCategoryAssignment)).one()
    assert assignment.category_id == new_category.id
    assert assignment.source == "manual"
    assert assignment.review_status == "accepted"


def test_update_transaction_category_returns_404_for_other_workspace_resources(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    service = ImportService(db_session)
    result = service.import_bytes(
        auth=auth,
        filename="fatura.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura.csv",
        content=b"data,lan\xc3\xa7amento,valor\n2026-05-08,PADARIA,26.06\n",
    )
    transaction = db_session.scalars(select(Transaction)).one()
    other_auth = AuthContext(user_id=auth.user_id, workspace_id=str(uuid4()))
    other_result = service.import_bytes(
        auth=other_auth,
        filename="outro-extrato.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{other_auth.workspace_id}/outro-extrato.txt",
        content=b"01/07/2025;PIX OUTRO;-20,00\n",
    )
    current_category = Category(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name="Alimentacao",
    )
    other_category = Category(
        id=str(uuid4()),
        workspace_id=other_auth.workspace_id,
        name="Outro",
    )
    db_session.add_all([current_category, other_category])
    db_session.commit()
    other_transaction = db_session.scalars(
        select(Transaction).where(Transaction.import_job_id == other_result.import_job_id)
    ).one()

    other_category_response = client.patch(
        f"/v1/transactions/{transaction.id}/category",
        json={"category_id": other_category.id},
    )
    other_transaction_response = client.patch(
        f"/v1/transactions/{other_transaction.id}/category",
        json={"category_id": current_category.id},
    )

    assert result.import_job_id != other_result.import_job_id
    assert other_category_response.status_code == 404
    assert other_transaction_response.status_code == 404
