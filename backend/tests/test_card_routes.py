from collections.abc import Iterator
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from sqlalchemy import select

from app.core.auth import AuthContext, get_auth_context
from app.db.models import (
    Base,
    CreditCard,
    CreditCardStatement,
    ImportJob,
    SourceFile,
    Transaction,
)
from app.db.session import get_db
from app.domain.imports import ParsedCreditCard, ParseResult, SourceKind
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


def test_credit_cards_can_be_created_and_listed(client: TestClient, auth: AuthContext) -> None:
    response = client.post(
        "/v1/credit-cards",
        json={
            "name": "Visa Infinite",
            "issuer": "Itau",
            "brand": "Visa",
            "last_four": "1234",
            "closing_day": 23,
            "due_day": 20,
            "limit_amount": "50000.00",
        },
    )

    assert response.status_code == 201
    card = response.json()
    assert card["workspace_id"] == auth.workspace_id
    assert card["name"] == "Visa Infinite"
    assert card["closing_day"] == 23
    assert card["due_day"] == 20
    assert card["limit_amount"] == "50000.00"

    list_response = client.get("/v1/credit-cards")

    assert list_response.status_code == 200
    payload = list_response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == card["id"]


def test_credit_card_can_be_updated(client: TestClient) -> None:
    create_response = client.post(
        "/v1/credit-cards",
        json={
            "name": "Cartao detectado",
            "closing_day": 23,
            "due_day": 20,
        },
    )
    assert create_response.status_code == 201
    card = create_response.json()

    update_response = client.patch(
        f"/v1/credit-cards/{card['id']}",
        json={
            "brand": "Mastercard",
            "closing_day": 25,
            "due_day": 5,
            "issuer": "Itau",
            "last_four": "9876",
            "limit_amount": "12000.00",
            "name": "Pao de Acucar Black",
        },
    )

    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["name"] == "Pao de Acucar Black"
    assert updated["issuer"] == "Itau"
    assert updated["brand"] == "Mastercard"
    assert updated["last_four"] == "9876"
    assert updated["closing_day"] == 25
    assert updated["due_day"] == 5
    assert updated["limit_amount"] == "12000.00"


def test_credit_card_statements_are_linked_to_workspace_card(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    card = CreditCard(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name="Master Black",
        closing_day=23,
        due_day=20,
    )
    other_card = CreditCard(
        id=str(uuid4()),
        workspace_id=str(uuid4()),
        name="Outro cartao",
        closing_day=23,
        due_day=20,
    )
    db_session.add_all([card, other_card])
    db_session.commit()

    forbidden = client.post(
        "/v1/credit-card-statements",
        json={
            "credit_card_id": other_card.id,
            "statement_month": "2026-04-01",
            "due_date": "2026-04-20",
        },
    )
    assert forbidden.status_code == 404

    response = client.post(
        "/v1/credit-card-statements",
        json={
            "credit_card_id": card.id,
            "statement_month": "2026-04-15",
            "closing_date": "2026-04-13",
            "due_date": "2026-04-20",
            "total_amount": "18172.21",
            "status": "closed",
        },
    )

    assert response.status_code == 201
    statement = response.json()
    assert statement["credit_card_id"] == card.id
    assert statement["statement_month"] == "2026-04-01"
    assert statement["due_date"] == "2026-04-20"
    assert statement["total_amount"] == "18172.21"
    assert statement["status"] == "closed"

    list_response = client.get(f"/v1/credit-card-statements?credit_card_id={card.id}")

    assert list_response.status_code == 200
    payload = list_response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == statement["id"]


def test_credit_card_statement_can_be_linked_to_imported_source_file(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    card = CreditCard(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name="Master Black",
        closing_day=23,
        due_day=20,
    )
    source_file = SourceFile(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        original_filename="fatura-auto.csv",
        content_hash="a" * 64,
        mime_type="text/csv",
        size_bytes=128,
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura-auto.csv",
        source_kind="credit_card_csv",
        created_by_user_id=auth.user_id,
    )
    db_session.add_all([card, source_file])
    db_session.commit()

    statement_response = client.post(
        "/v1/credit-card-statements",
        json={
            "credit_card_id": card.id,
            "statement_month": "2026-04-01",
            "due_date": "2026-04-20",
        },
    )
    assert statement_response.status_code == 201
    statement = statement_response.json()

    link_response = client.patch(
        f"/v1/credit-card-statements/{statement['id']}/source-file",
        json={"source_file_id": source_file.id},
    )

    assert link_response.status_code == 200
    assert link_response.json()["source_file_id"] == source_file.id


def test_credit_card_source_file_association_creates_statement_from_filename(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    card = CreditCard(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name="Master Black",
        closing_day=13,
        due_day=20,
    )
    source_file = SourceFile(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        original_filename="fatura-20260420.csv",
        content_hash="b" * 64,
        mime_type="text/csv",
        size_bytes=128,
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/fatura-20260420.csv",
        source_kind="credit_card_csv",
        created_by_user_id=auth.user_id,
    )
    db_session.add_all([card, source_file])
    db_session.commit()

    response = client.post(f"/v1/credit-cards/{card.id}/statement-source-files/{source_file.id}")

    assert response.status_code == 200
    statement = response.json()
    assert statement["credit_card_id"] == card.id
    assert statement["source_file_id"] == source_file.id
    assert statement["statement_month"] == "2026-04-01"
    assert statement["closing_date"] == "2026-04-13"
    assert statement["due_date"] == "2026-04-20"
    assert statement["status"] == "closed"


def test_credit_card_source_file_association_falls_back_to_transaction_dates(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    card = CreditCard(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name="Master Black",
        closing_day=23,
        due_day=5,
    )
    source_file = SourceFile(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        original_filename="itau-mastercard.csv",
        content_hash="c" * 64,
        mime_type="text/csv",
        size_bytes=128,
        storage_bucket="financial-files",
        storage_path=f"{auth.workspace_id}/itau-mastercard.csv",
        source_kind="credit_card_csv",
        created_by_user_id=auth.user_id,
    )
    import_job = ImportJob(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        source_file_id=source_file.id,
        status="completed",
        total_rows=3,
        valid_rows=3,
        error_rows=0,
    )
    purchase = Transaction(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        source_file_id=source_file.id,
        import_job_id=import_job.id,
        source_type="credit_card_statement",
        transaction_date=date(2026, 4, 20),
        description="PADARIA",
        raw_description="PADARIA",
        amount=Decimal("20.00"),
        direction="debit",
        dedupe_key="fallback-card-date",
    )
    refund = Transaction(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        source_file_id=source_file.id,
        import_job_id=import_job.id,
        source_type="credit_card_statement",
        transaction_date=date(2026, 4, 21),
        description="ESTORNO PADARIA",
        raw_description="ESTORNO PADARIA",
        amount=Decimal("-5.00"),
        direction="credit",
        dedupe_key="fallback-card-refund",
    )
    payment = Transaction(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        source_file_id=source_file.id,
        import_job_id=import_job.id,
        source_type="credit_card_statement",
        transaction_date=date(2026, 4, 22),
        description="PAGAMENTO EFETUADO",
        raw_description="PAGAMENTO EFETUADO",
        amount=Decimal("-15.00"),
        direction="payment",
        dedupe_key="fallback-card-payment",
    )
    db_session.add_all([card, source_file, import_job, purchase, refund, payment])
    db_session.commit()

    response = client.post(f"/v1/credit-cards/{card.id}/statement-source-files/{source_file.id}")

    assert response.status_code == 200
    statement = response.json()
    assert statement["credit_card_id"] == card.id
    assert statement["source_file_id"] == source_file.id
    assert statement["statement_month"] == "2026-05-01"
    assert statement["closing_date"] == "2026-04-23"
    assert statement["due_date"] == "2026-05-05"
    assert statement["total_amount"] == "15.00"


# ---------------------------------------------------------------------------
# Card identity by BIN (reissue handling) + manual merge
# ---------------------------------------------------------------------------

def _pdf_source_file(db: Session, workspace_id: str, name: str) -> SourceFile:
    source_file = SourceFile(
        id=str(uuid4()),
        workspace_id=workspace_id,
        original_filename=name,
        content_hash=str(uuid4()),
        mime_type="application/pdf",
        size_bytes=1,
        storage_bucket="local",
        storage_path=f"local/{name}",
        source_kind="credit_card_pdf",
        created_by_user_id=str(uuid4()),
    )
    db.add(source_file)
    db.flush()
    return source_file


def _register_pdf_card(
    db: Session,
    workspace_id: str,
    source_file: SourceFile,
    *,
    last_four: str,
    card_bin: str,
    due: date,
    name: str = "Visa Infinite",
    brand: str = "visa",
) -> None:
    card_info = ParsedCreditCard(
        last_four=last_four,
        bin=card_bin,
        brand=brand,
        name=name,
        closing_day=5,
        due_day=15,
        due_date=due,
        statement_total=Decimal("100.00"),
    )
    result = ParseResult(
        source_kind=SourceKind.CREDIT_CARD_PDF, total_rows=0, credit_card=card_info
    )
    ImportService(db)._register_pdf_credit_card(workspace_id, source_file, result)


def test_reissued_card_is_one_card_matched_by_bin(db_session: Session) -> None:
    ws = str(uuid4())
    _register_pdf_card(
        db_session, ws, _pdf_source_file(db_session, ws, "2023_01.pdf"),
        last_four="9163", card_bin="4771", due=date(2023, 1, 15),
    )
    _register_pdf_card(
        db_session, ws, _pdf_source_file(db_session, ws, "2023_02.pdf"),
        last_four="1359", card_bin="4771", due=date(2023, 2, 15),
    )
    db_session.commit()

    cards = db_session.scalars(
        select(CreditCard).where(CreditCard.workspace_id == ws)
    ).all()
    assert len(cards) == 1
    card = cards[0]
    assert card.last_four == "1359"  # newest plastic is current
    assert card.previous_last_four == ["9163"]  # old plastic archived
    statements = db_session.scalars(
        select(CreditCardStatement).where(CreditCardStatement.credit_card_id == card.id)
    ).all()
    assert len(statements) == 2  # both faturas resolve to the one card


def test_reissue_import_out_of_order_keeps_newest_as_current(db_session: Session) -> None:
    ws = str(uuid4())
    # newest first, then the older statement of the previous plastic
    _register_pdf_card(
        db_session, ws, _pdf_source_file(db_session, ws, "2023_02.pdf"),
        last_four="1359", card_bin="4771", due=date(2023, 2, 15),
    )
    _register_pdf_card(
        db_session, ws, _pdf_source_file(db_session, ws, "2023_01.pdf"),
        last_four="9163", card_bin="4771", due=date(2023, 1, 15),
    )
    db_session.commit()

    card = db_session.scalars(
        select(CreditCard).where(CreditCard.workspace_id == ws)
    ).one()
    assert card.last_four == "1359"
    assert card.previous_last_four == ["9163"]


def test_different_bin_stays_a_separate_card(db_session: Session) -> None:
    ws = str(uuid4())
    _register_pdf_card(
        db_session, ws, _pdf_source_file(db_session, ws, "visa.pdf"),
        last_four="1359", card_bin="4771", due=date(2023, 2, 15),
    )
    _register_pdf_card(
        db_session, ws, _pdf_source_file(db_session, ws, "master.pdf"),
        last_four="3123", card_bin="5234", due=date(2023, 2, 15),
        name="Mastercard Black", brand="mastercard",
    )
    db_session.commit()

    cards = db_session.scalars(
        select(CreditCard).where(CreditCard.workspace_id == ws)
    ).all()
    assert len(cards) == 2


def test_merge_cards_moves_statements_and_records_history(
    client: TestClient, db_session: Session, auth: AuthContext
) -> None:
    keep = client.post(
        "/v1/credit-cards",
        json={"name": "Mastercard 7164", "last_four": "7164", "closing_day": 5, "due_day": 15},
    ).json()
    drop = client.post(
        "/v1/credit-cards",
        json={"name": "Mastercard 6645", "last_four": "6645", "closing_day": 5, "due_day": 15},
    ).json()
    db_session.add(
        CreditCardStatement(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            credit_card_id=drop["id"],
            statement_month=date(2023, 10, 1),
            due_date=date(2023, 10, 15),
            total_amount=Decimal("100.00"),
            status="closed",
        )
    )
    db_session.commit()

    response = client.post(
        f"/v1/credit-cards/{keep['id']}/merge", json={"source_card_id": drop["id"]}
    )

    assert response.status_code == 200
    merged = response.json()
    assert merged["last_four"] == "7164"
    assert "6645" in merged["previous_last_four"]
    # the dropped card is gone
    assert client.get("/v1/credit-cards").json()["total"] == 1
    # its statement now belongs to the kept card
    moved = db_session.scalars(
        select(CreditCardStatement).where(
            CreditCardStatement.credit_card_id == keep["id"]
        )
    ).all()
    assert len(moved) == 1
