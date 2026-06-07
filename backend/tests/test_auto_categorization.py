"""
Tests for Slice 11 — auto-categorization endpoint and EmbeddingService.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date
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
    Category,
    ImportJob,
    SourceFile,
    Transaction,
    TransactionCategoryAssignment,
)
from app.db.session import get_db
from app.main import create_app
from app.services.embedding_service import EmbeddingService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_source_file(workspace_id: str, db: Session) -> SourceFile:
    sf = SourceFile(
        id=str(uuid4()),
        workspace_id=workspace_id,
        original_filename="bank.txt",
        content_hash="a" * 64,
        mime_type="text/plain",
        size_bytes=256,
        storage_bucket="financial-files",
        storage_path=f"{workspace_id}/bank.txt",
        source_kind="bank_statement_txt",
        created_by_user_id=str(uuid4()),
    )
    db.add(sf)
    db.flush()
    return sf


def _make_import_job(workspace_id: str, source_file_id: str, db: Session) -> ImportJob:
    job = ImportJob(
        id=str(uuid4()),
        workspace_id=workspace_id,
        source_file_id=source_file_id,
        status="completed",
        total_rows=1,
        valid_rows=1,
        error_rows=0,
    )
    db.add(job)
    db.flush()
    return job


def _make_transaction(
    workspace_id: str,
    source_file_id: str,
    import_job_id: str,
    description: str,
    db: Session,
    dedupe_key: str | None = None,
) -> Transaction:
    txn = Transaction(
        id=str(uuid4()),
        workspace_id=workspace_id,
        source_file_id=source_file_id,
        import_job_id=import_job_id,
        source_type="bank_statement",
        description=description,
        raw_description=description,
        transaction_date=date(2026, 1, 15),
        amount=Decimal("50.00"),
        direction="debit",
        dedupe_key=dedupe_key or str(uuid4()),
    )
    db.add(txn)
    db.flush()
    return txn


# ---------------------------------------------------------------------------
# Unit tests — EmbeddingService
# ---------------------------------------------------------------------------


class _MockSettings:
    ANTHROPIC_API_KEY = ""
    CATEGORIZATION_CONFIDENCE_THRESHOLD = 0.75
    CATEGORIZATION_AUTO_ACCEPT = False


def test_jaccard_similarity_identical_text() -> None:
    svc = EmbeddingService(_MockSettings())
    assert svc.text_similarity("IFOOD LTDA", "IFOOD LTDA") == 1.0


def test_jaccard_similarity_partial_overlap() -> None:
    svc = EmbeddingService(_MockSettings())
    score = svc.text_similarity("IFOOD LTDA PAGAMENTOS", "IFOOD LTDA")
    assert 0.0 < score < 1.0


def test_jaccard_similarity_no_overlap() -> None:
    svc = EmbeddingService(_MockSettings())
    assert svc.text_similarity("NETFLIX", "PADARIA CENTRAL") == 0.0


def test_find_best_category_returns_best_match() -> None:
    svc = EmbeddingService(_MockSettings())
    examples = [
        ("IFOOD LTDA", "cat-food"),
        ("UBER TRIP", "cat-transport"),
        ("NETFLIX INC", "cat-streaming"),
    ]
    cat_id, confidence = svc.find_best_category("IFOOD PAGAMENTO", examples)
    assert cat_id == "cat-food"
    assert confidence > 0.0


def test_find_best_category_empty_examples() -> None:
    svc = EmbeddingService(_MockSettings())
    cat_id, confidence = svc.find_best_category("IFOOD PAGAMENTO", [])
    assert cat_id is None
    assert confidence == 0.0


# ---------------------------------------------------------------------------
# Integration tests — endpoint
# ---------------------------------------------------------------------------


def test_dry_run_returns_suggestions_without_creating_assignments(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    """dry_run=True must return suggestions but not persist any assignment."""
    sf = _make_source_file(auth.workspace_id, db_session)
    job = _make_import_job(auth.workspace_id, sf.id, db_session)

    category = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Alimentação")
    db_session.add(category)
    db_session.flush()

    # One already-categorized reference transaction
    ref_txn = _make_transaction(auth.workspace_id, sf.id, job.id, "IFOOD LTDA", db_session)
    assignment = TransactionCategoryAssignment(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        transaction_id=ref_txn.id,
        category_id=category.id,
        source="manual",
        review_status="accepted",
    )
    db_session.add(assignment)

    # One uncategorized transaction similar to the reference
    _make_transaction(auth.workspace_id, sf.id, job.id, "IFOOD PAGAMENTO APP", db_session)
    db_session.commit()

    response = client.post(
        "/v1/transactions/auto-categorize",
        json={"dry_run": True},
    )
    assert response.status_code == 200
    payload = response.json()

    # Should have found a suggestion
    assert payload["processed"] >= 1
    assert payload["suggested"] >= 1

    # No assignments should have been created (dry_run)
    all_assignments = db_session.execute(
        select(TransactionCategoryAssignment)
        .where(TransactionCategoryAssignment.workspace_id == auth.workspace_id)
        .where(TransactionCategoryAssignment.source == "embedding")
    ).scalars().all()
    assert len(all_assignments) == 0


def test_with_examples_suggests_correct_category(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    """Endpoint should suggest the category whose examples best match the description."""
    sf = _make_source_file(auth.workspace_id, db_session)
    job = _make_import_job(auth.workspace_id, sf.id, db_session)

    food_cat = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Alimentação")
    transport_cat = Category(id=str(uuid4()), workspace_id=auth.workspace_id, name="Transporte")
    db_session.add_all([food_cat, transport_cat])
    db_session.flush()

    # Two reference transactions in different categories
    ref_food = _make_transaction(auth.workspace_id, sf.id, job.id, "IFOOD LTDA", db_session)
    ref_uber = _make_transaction(auth.workspace_id, sf.id, job.id, "UBER TRIP", db_session)
    db_session.add_all([
        TransactionCategoryAssignment(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            transaction_id=ref_food.id,
            category_id=food_cat.id,
            source="manual",
            review_status="accepted",
        ),
        TransactionCategoryAssignment(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            transaction_id=ref_uber.id,
            category_id=transport_cat.id,
            source="manual",
            review_status="accepted",
        ),
    ])

    # Uncategorized transaction similar to the food reference
    target = _make_transaction(
        auth.workspace_id, sf.id, job.id, "IFOOD PAGAMENTO ONLINE", db_session
    )
    db_session.commit()

    response = client.post(
        "/v1/transactions/auto-categorize",
        json={"dry_run": True, "transaction_ids": [target.id]},
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["processed"] == 1
    assert payload["suggested"] == 1

    detail = payload["details"][0]
    assert detail["transaction_id"] == target.id
    assert detail["suggested_category_id"] == food_cat.id
    assert detail["source"] == "embedding"
    assert detail["confidence"] > 0.0


def test_without_examples_no_suggestions(
    client: TestClient,
    db_session: Session,
    auth: AuthContext,
) -> None:
    """When there are no categorized reference transactions, nothing can be suggested."""
    sf = _make_source_file(auth.workspace_id, db_session)
    job = _make_import_job(auth.workspace_id, sf.id, db_session)

    _make_transaction(auth.workspace_id, sf.id, job.id, "NETFLIX INC", db_session)
    _make_transaction(auth.workspace_id, sf.id, job.id, "SPOTIFY AB", db_session)
    db_session.commit()

    response = client.post("/v1/transactions/auto-categorize", json={})
    assert response.status_code == 200
    payload = response.json()

    assert payload["processed"] == 2
    assert payload["suggested"] == 0
    assert payload["details"] == []
