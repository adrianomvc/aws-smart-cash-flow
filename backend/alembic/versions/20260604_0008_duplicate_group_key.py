"""Add duplicate_group_key pre-computed column to transactions."""

import sqlalchemy as sa

from alembic import op

revision = "20260604_0008"
down_revision = "20260604_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("duplicate_group_key", sa.String(64), nullable=True),
    )
    op.create_index(
        "ix_transaction_duplicate_group",
        "transactions",
        ["workspace_id", "duplicate_group_key"],
    )


def downgrade() -> None:
    op.drop_index("ix_transaction_duplicate_group", table_name="transactions")
    op.drop_column("transactions", "duplicate_group_key")
