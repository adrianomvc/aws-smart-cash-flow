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
    assert payload["total"] == 2
    assert payload["limit"] == 50
    assert payload["offset"] == 0
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
    assert payload["total"] == 1
    assert [item["description"] for item in payload["items"]] == ["PADARIA"]


def test_list_transactions_filters_by_weekday(
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
        b"2026-05-05,UBER,25.00\n",
    )

    response = client.get("/v1/transactions", params={"weekday": 0})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert [item["description"] for item in payload["items"]] == ["PADARIA"]


def test_list_transactions_filters_by_import_job(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    first = ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura-maio.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura-maio.csv",
        content=b"data,lan\xc3\xa7amento,valor\n2026-05-08,PADARIA,26.06\n",
    )
    ImportService(db_session).import_bytes(
        auth=auth,
        filename="fatura-junho.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura-junho.csv",
        content=b"data,lan\xc3\xa7amento,valor\n2026-06-08,UBER,12.50\n",
    )

    response = client.get("/v1/transactions", params={"import_job_id": first.import_job_id})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert [item["description"] for item in payload["items"]] == ["PADARIA"]
    assert payload["items"][0]["import_job_id"] == first.import_job_id


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
    assert payload["total"] == 1
    assert payload["limit"] == 1
    assert payload["offset"] == 0
    assert len(payload["items"]) == 1
    assert payload["items"][0]["description"] == "UBER"
    assert payload["items"][0]["category_id"] == category.id
    assert payload["items"][0]["category_source"] == "manual"
    assert payload["items"][0]["category_review_status"] == "accepted"


def test_list_transactions_parent_category_filter_includes_direct_children(
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
        b"2026-05-09,IFOOD,12.50\n"
        b"2026-05-10,UBER,20.00\n",
    )
    parent = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Alimentacao")
    child = Category(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name="Delivery",
        parent_category_id=parent.id,
    )
    other = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Transporte")
    db_session.add_all([parent, child, other])
    padaria = db_session.scalars(select(Transaction).where(Transaction.description == "PADARIA")).one()
    ifood = db_session.scalars(select(Transaction).where(Transaction.description == "IFOOD")).one()
    uber = db_session.scalars(select(Transaction).where(Transaction.description == "UBER")).one()
    db_session.add_all(
        [
            TransactionCategoryAssignment(
                id=str(uuid4()),
                workspace_id=auth.workspace_id,
                transaction_id=padaria.id,
                category_id=parent.id,
                source="manual",
                confidence=Decimal("1.0000"),
                review_status="accepted",
            ),
            TransactionCategoryAssignment(
                id=str(uuid4()),
                workspace_id=auth.workspace_id,
                transaction_id=ifood.id,
                category_id=child.id,
                source="manual",
                confidence=Decimal("1.0000"),
                review_status="accepted",
            ),
            TransactionCategoryAssignment(
                id=str(uuid4()),
                workspace_id=auth.workspace_id,
                transaction_id=uber.id,
                category_id=other.id,
                source="manual",
                confidence=Decimal("1.0000"),
                review_status="accepted",
            ),
        ]
    )
    db_session.commit()

    parent_response = client.get("/v1/transactions", params={"category_id": parent.id})
    child_response = client.get("/v1/transactions", params={"category_id": child.id})

    assert parent_response.status_code == 200
    assert child_response.status_code == 200
    assert {item["description"] for item in parent_response.json()["items"]} == {
        "PADARIA",
        "IFOOD",
    }
    assert [item["description"] for item in child_response.json()["items"]] == ["IFOOD"]


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


def test_update_transaction_category_accepts_null_to_clear_assignment(
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
    category = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Transporte")
    db_session.add(category)
    db_session.add(
        TransactionCategoryAssignment(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            transaction_id=transaction.id,
            category_id=category.id,
            source="manual",
            confidence=Decimal("1.0000"),
            review_status="accepted",
        )
    )
    db_session.commit()

    response = client.patch(
        f"/v1/transactions/{transaction.id}/category",
        json={"category_id": None},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["category"] is None
    assert payload["category_id"] is None
    assert payload["category_source"] is None
    assert db_session.scalars(select(TransactionCategoryAssignment)).first() is None


def test_update_transaction_direction_changes_current_workspace_transaction(
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
        content=b"03/05/2026;PAGAMENTO CARTAO;-800,00\n",
    )
    other_auth = AuthContext(user_id=auth.user_id, workspace_id=str(uuid4()))
    service.import_bytes(
        auth=other_auth,
        filename="outro.txt",
        mime_type="text/plain",
        storage_bucket="financial-files",
        storage_path=f"{other_auth.workspace_id}/outro.txt",
        content=b"03/05/2026;PAGAMENTO CARTAO;-900,00\n",
    )
    transaction = db_session.scalars(
        select(Transaction).where(Transaction.workspace_id == auth.workspace_id)
    ).one()
    other_transaction = db_session.scalars(
        select(Transaction).where(Transaction.workspace_id == other_auth.workspace_id)
    ).one()

    response = client.patch(
        f"/v1/transactions/{transaction.id}/direction",
        json={"direction": "payment"},
    )
    invalid_response = client.patch(
        f"/v1/transactions/{transaction.id}/direction",
        json={"direction": "transfer"},
    )
    other_response = client.patch(
        f"/v1/transactions/{other_transaction.id}/direction",
        json={"direction": "payment"},
    )

    assert response.status_code == 200
    assert response.json()["direction"] == "payment"
    assert invalid_response.status_code == 400
    assert other_response.status_code == 404
    db_session.refresh(transaction)
    db_session.refresh(other_transaction)
    assert transaction.direction == "payment"
    assert other_transaction.direction == "debit"


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


def test_delete_transaction_removes_current_workspace_transaction_and_assignment(
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
        content=b"data,lan\xc3\xa7amento,valor\n2026-05-08,PADARIA,26.06\n",
    )
    other_auth = AuthContext(user_id=auth.user_id, workspace_id=str(uuid4()))
    service.import_bytes(
        auth=other_auth,
        filename="outra-fatura.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{other_auth.workspace_id}/outra-fatura.csv",
        content=b"data,lan\xc3\xa7amento,valor\n2026-05-08,UBER,12.50\n",
    )
    transaction = db_session.scalars(
        select(Transaction).where(Transaction.workspace_id == auth.workspace_id)
    ).one()
    other_transaction = db_session.scalars(
        select(Transaction).where(Transaction.workspace_id == other_auth.workspace_id)
    ).one()
    category = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Alimentacao")
    db_session.add(category)
    db_session.add(
        TransactionCategoryAssignment(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            transaction_id=transaction.id,
            category_id=category.id,
            source="manual",
            confidence=Decimal("1.0000"),
            review_status="accepted",
        )
    )
    db_session.commit()

    response = client.delete(f"/v1/transactions/{transaction.id}")
    other_response = client.delete(f"/v1/transactions/{other_transaction.id}")

    assert response.status_code == 204
    assert other_response.status_code == 404
    assert db_session.scalars(select(Transaction).where(Transaction.id == transaction.id)).first() is None
    assert db_session.scalars(
        select(TransactionCategoryAssignment).where(
            TransactionCategoryAssignment.transaction_id == transaction.id
        )
    ).first() is None
    assert db_session.scalars(select(Transaction).where(Transaction.id == other_transaction.id)).one()


def test_normalize_transaction_descriptions_updates_current_workspace_only(
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
        content=b"data,lan\xc3\xa7amento,valor\n2026-05-08,99APP       *99App,26.06\n",
    )
    other_auth = AuthContext(user_id=auth.user_id, workspace_id=str(uuid4()))
    service.import_bytes(
        auth=other_auth,
        filename="outra-fatura.csv",
        mime_type="text/csv",
        storage_bucket="financial-files",
        storage_path=f"{other_auth.workspace_id}/outra-fatura.csv",
        content=b"data,lan\xc3\xa7amento,valor\n2026-05-08,MERCADOLIVRE*LOJA EXEMPLO,26.06\n",
    )
    transaction = db_session.scalars(
        select(Transaction).where(Transaction.workspace_id == auth.workspace_id)
    ).one()
    other_transaction = db_session.scalars(
        select(Transaction).where(Transaction.workspace_id == other_auth.workspace_id)
    ).one()
    transaction.description = "99APP 99APP"
    other_transaction.description = "MERCADOLIVRE LOJA EXEMPLO"
    db_session.commit()

    response = client.post("/v1/transactions/normalize-descriptions")

    assert response.status_code == 200
    payload = response.json()
    assert payload["workspace_id"] == auth.workspace_id
    assert payload["scanned_count"] == 1
    assert payload["changed_count"] == 1

    db_session.refresh(transaction)
    db_session.refresh(other_transaction)
    assert transaction.description == "99APP"
    assert transaction.raw_description == "99APP       *99App"
    assert other_transaction.description == "MERCADOLIVRE LOJA EXEMPLO"
