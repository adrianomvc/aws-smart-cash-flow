"""Investment position domain: custodies, assets and value snapshots."""

import sqlalchemy as sa

from alembic import op

revision = "20260614_0018"
down_revision = "20260613_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "investment_custodies",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=True),
        sa.Column("account_type", sa.String(length=16), nullable=False, server_default="broker"),
        sa.Column("brand", sa.String(length=8), nullable=True),
        sa.Column("color", sa.Text(), nullable=True),
        sa.Column("sync_mode", sa.Text(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.UniqueConstraint("workspace_id", "name", name="uq_investment_custody_workspace_name"),
    )

    op.create_table(
        "investment_assets",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("custody_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("asset_class", sa.String(length=16), nullable=False, server_default="other"),
        sa.Column("risk", sa.Text(), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("current_value", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("contributed", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.ForeignKeyConstraint(["custody_id"], ["investment_custodies.id"], ondelete="CASCADE"),
        sa.CheckConstraint("current_value >= 0", name="ck_investment_asset_value_non_negative"),
        sa.CheckConstraint("contributed >= 0", name="ck_investment_asset_contributed_non_negative"),
    )

    op.create_table(
        "investment_snapshots",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("asset_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("as_of", sa.Date(), nullable=False),
        sa.Column("value", sa.Numeric(14, 2), nullable=False),
        sa.Column("contributed", sa.Numeric(14, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.ForeignKeyConstraint(["asset_id"], ["investment_assets.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("asset_id", "as_of", name="uq_investment_snapshot_asset_date"),
    )
    op.create_index(
        "ix_investment_snapshot_asset_date",
        "investment_snapshots",
        ["asset_id", "as_of"],
    )


def downgrade() -> None:
    op.drop_index("ix_investment_snapshot_asset_date", table_name="investment_snapshots")
    op.drop_table("investment_snapshots")
    op.drop_table("investment_assets")
    op.drop_table("investment_custodies")
