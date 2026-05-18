"""track duplicate transaction rows

Revision ID: 20260518_0002
Revises: 20260517_0002
Create Date: 2026-05-18
"""

from collections.abc import Sequence
from decimal import Decimal
from hashlib import sha256
from unicodedata import normalize

import sqlalchemy as sa

from alembic import op

revision: str = "20260518_0002"
down_revision: str | None = "20260517_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "import_jobs",
        sa.Column("duplicate_rows", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("transactions", sa.Column("natural_dedupe_key", sa.String(length=64)))
    _backfill_natural_dedupe_keys()
    op.create_index(
        "uq_transaction_natural_dedupe",
        "transactions",
        ["workspace_id", "natural_dedupe_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_transaction_natural_dedupe", table_name="transactions")
    op.drop_column("transactions", "natural_dedupe_key")
    op.drop_column("import_jobs", "duplicate_rows")


def _backfill_natural_dedupe_keys() -> None:
    connection = op.get_bind()
    transactions = sa.table(
        "transactions",
        sa.column("id", sa.String),
        sa.column("workspace_id", sa.String),
        sa.column("source_type", sa.String),
        sa.column("transaction_date", sa.Date),
        sa.column("raw_description", sa.Text),
        sa.column("amount", sa.Numeric),
        sa.column("direction", sa.String),
        sa.column("natural_dedupe_key", sa.String),
    )
    seen: set[str] = set()
    rows = connection.execute(
        sa.select(
            transactions.c.id,
            transactions.c.workspace_id,
            transactions.c.source_type,
            transactions.c.transaction_date,
            transactions.c.raw_description,
            transactions.c.amount,
            transactions.c.direction,
        ).order_by(transactions.c.id)
    )
    for row in rows:
        key = _natural_key(
            workspace_id=row.workspace_id,
            source_type=row.source_type,
            transaction_date=row.transaction_date.isoformat(),
            raw_description=row.raw_description,
            amount=_normalize_amount(row.amount),
            direction=row.direction,
        )
        if key in seen:
            continue
        seen.add(key)
        connection.execute(
            transactions.update()
            .where(transactions.c.id == row.id)
            .values(natural_dedupe_key=key)
        )


def _natural_key(
    workspace_id: str,
    source_type: str,
    transaction_date: str,
    raw_description: str,
    amount: str,
    direction: str,
) -> str:
    raw_key = "|".join(
        [
            workspace_id,
            source_type,
            transaction_date,
            _normalize_description(raw_description),
            amount,
            direction,
        ]
    )
    return sha256(raw_key.encode("utf-8")).hexdigest()


def _normalize_description(value: str) -> str:
    without_accents = "".join(
        char for char in normalize("NFKD", value) if char.encode("ascii", "ignore") != b""
    )
    return " ".join(without_accents.upper().split())


def _normalize_amount(value: object) -> str:
    return str(Decimal(str(value)).quantize(Decimal("0.01")))
