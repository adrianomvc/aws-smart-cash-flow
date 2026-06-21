"""User-editable merchant/institution aliases (rename messy descriptions)."""

import sqlalchemy as sa

from alembic import op

revision = "20260621_0025"
down_revision = "20260617_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "merchant_aliases",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("pattern", sa.Text(), nullable=False),
        sa.Column("replacement", sa.Text(), nullable=False),
        sa.Column("match_type", sa.String(16), server_default="contains", nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.UniqueConstraint("workspace_id", "pattern", name="uq_merchant_alias_workspace_pattern"),
        sa.CheckConstraint(
            "match_type in ('contains', 'equals', 'token')",
            name="ck_merchant_alias_match_type",
        ),
    )


def downgrade() -> None:
    op.drop_table("merchant_aliases")
