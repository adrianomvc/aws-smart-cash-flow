"""Workspace financial preferences."""

import sqlalchemy as sa

from alembic import op

revision = "20260613_0017"
down_revision = "20260613_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workspace_preferences",
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="BRL"),
        sa.Column("savings_target_pct", sa.Numeric(5, 4), nullable=False, server_default="0.2000"),
        sa.Column("commitment_limit_pct", sa.Numeric(5, 4), nullable=False, server_default="0.3500"),
        sa.Column("risk_profile", sa.String(length=16), nullable=False, server_default="moderate"),
        sa.Column("burn_rate_window_months", sa.Integer(), nullable=False, server_default="12"),
        sa.Column("protected_reserve", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
    )


def downgrade() -> None:
    op.drop_table("workspace_preferences")
