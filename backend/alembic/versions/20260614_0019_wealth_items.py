"""Net-worth (wealth) manual items: assets and liabilities."""

import sqlalchemy as sa

from alembic import op

revision = "20260614_0019"
down_revision = "20260614_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "wealth_items",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=24), nullable=True),
        sa.Column("value", sa.Numeric(14, 2), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.CheckConstraint("kind in ('asset', 'liability')", name="ck_wealth_item_kind"),
        sa.CheckConstraint("value >= 0", name="ck_wealth_item_value_non_negative"),
    )


def downgrade() -> None:
    op.drop_table("wealth_items")
