"""
Slice 11/12 — Auto-categorization endpoint.

POST /v1/transactions/auto-categorize

Orchestrates EmbeddingService (Jaccard fallback) to suggest categories for
uncategorized transactions. When confidence >= threshold and not dry_run,
creates a TransactionCategoryAssignment with source='embedding'.
"""

from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, get_auth_context
from app.core.config import get_settings
from app.db.models import Category, Transaction, TransactionCategoryAssignment
from app.db.session import get_db
from app.services.embedding_service import EmbeddingService

router = APIRouter(tags=["auto-categorization"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class AutoCategorizeRequest(BaseModel):
    transaction_ids: list[str] | None = None  # None = all uncategorized
    dry_run: bool = False
    max_transactions: int = 100


class SuggestionDetail(BaseModel):
    transaction_id: str
    description: str
    suggested_category_id: str
    suggested_category_name: str
    confidence: float
    source: str
    reason: str


class AutoCategorizeResponse(BaseModel):
    processed: int
    suggested: int
    skipped_no_match: int
    would_auto_accept: int
    details: list[SuggestionDetail]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/transactions/auto-categorize", response_model=AutoCategorizeResponse)
def auto_categorize(
    body: AutoCategorizeRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context),
) -> AutoCategorizeResponse:
    settings = get_settings()
    embedding_svc = EmbeddingService(settings)

    # ------------------------------------------------------------------
    # 1. Fetch uncategorized transactions (or the ones explicitly listed)
    # ------------------------------------------------------------------
    assigned_subq = select(TransactionCategoryAssignment.transaction_id)

    if body.transaction_ids:
        uncategorized_q = (
            select(Transaction)
            .where(Transaction.workspace_id == auth.workspace_id)
            .where(Transaction.id.in_(body.transaction_ids))
            .where(Transaction.id.notin_(assigned_subq))
            .limit(body.max_transactions)
        )
    else:
        uncategorized_q = (
            select(Transaction)
            .where(Transaction.workspace_id == auth.workspace_id)
            .where(Transaction.id.notin_(assigned_subq))
            .limit(body.max_transactions)
        )

    uncategorized: list[Transaction] = list(db.execute(uncategorized_q).scalars())

    # ------------------------------------------------------------------
    # 2. Fetch categorized transactions as reference examples
    # ------------------------------------------------------------------
    categorized_q = (
        select(Transaction, TransactionCategoryAssignment)
        .join(
            TransactionCategoryAssignment,
            TransactionCategoryAssignment.transaction_id == Transaction.id,
        )
        .where(Transaction.workspace_id == auth.workspace_id)
        .limit(2000)
    )
    rows = list(db.execute(categorized_q))
    examples: list[tuple[str, str]] = [(t.description, a.category_id) for t, a in rows]

    # Build category id->name lookup
    category_names: dict[str, str] = {}
    if examples:
        cat_ids = list({cid for _, cid in examples})
        cats = db.execute(
            select(Category).where(Category.id.in_(cat_ids))
        ).scalars()
        category_names = {c.id: c.name for c in cats}

    # ------------------------------------------------------------------
    # 3. Score each uncategorized transaction
    # ------------------------------------------------------------------
    details: list[SuggestionDetail] = []
    suggested_count = 0
    skipped_count = 0
    would_auto_accept = 0

    for txn in uncategorized:
        category_id, confidence = embedding_svc.find_best_category(txn.description, examples)

        if category_id is None or confidence == 0.0:
            skipped_count += 1
            continue

        cat_name = category_names.get(category_id, category_id)
        reason = (
            f"Jaccard similarity {confidence:.2f} with similar transaction "
            f"in category '{cat_name}'"
        )
        detail = SuggestionDetail(
            transaction_id=txn.id,
            description=txn.description,
            suggested_category_id=category_id,
            suggested_category_name=cat_name,
            confidence=round(confidence, 4),
            source="embedding",
            reason=reason,
        )
        details.append(detail)
        suggested_count += 1

        meets_threshold = confidence >= settings.CATEGORIZATION_CONFIDENCE_THRESHOLD
        if meets_threshold:
            would_auto_accept += 1

        # ------------------------------------------------------------------
        # 4. Persist if not dry_run and confidence >= threshold
        # ------------------------------------------------------------------
        if not body.dry_run and meets_threshold:
            review_status = "accepted" if settings.CATEGORIZATION_AUTO_ACCEPT else "pending"
            assignment = TransactionCategoryAssignment(
                id=str(uuid4()),
                workspace_id=auth.workspace_id,
                transaction_id=txn.id,
                category_id=category_id,
                source="embedding",
                confidence=round(confidence, 4),
                reason=reason,
                review_status=review_status,
            )
            db.add(assignment)

    if not body.dry_run:
        db.commit()

    return AutoCategorizeResponse(
        processed=len(uncategorized),
        suggested=suggested_count,
        skipped_no_match=skipped_count,
        would_auto_accept=would_auto_accept,
        details=details,
    )
