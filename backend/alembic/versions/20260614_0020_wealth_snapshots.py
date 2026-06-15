"""Net-worth item value snapshots for real evolution."""

import sqlalchemy as sa

from alembic import op

revision = "20260614_0020"
down_revision = "20260614_0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "wealth_snapshots",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("item_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("as_of", sa.Date(), nullable=False),
        sa.Column("value", sa.Numeric(14, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["wealth_items.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("item_id", "as_of", name="uq_wealth_snapshot_item_date"),
    )
    op.create_index("ix_wealth_snapshot_item_date", "wealth_snapshots", ["item_id", "as_of"])


def downgrade() -> None:
    op.drop_index("ix_wealth_snapshot_item_date", table_name="wealth_snapshots")
    op.drop_table("wealth_snapshots")
