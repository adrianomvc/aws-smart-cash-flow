"""LLM categorization cache (one call per unique description, per workspace)."""

import sqlalchemy as sa

from alembic import op

revision = "20260615_0023"
down_revision = "20260614_0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_categorization_cache",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("category_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("description_key", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Numeric(6, 4), nullable=True),
        sa.Column("regex_suggestion", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("workspace_id", "description_key", name="uq_llm_cache_ws_desc"),
    )
    op.create_index(
        "ix_llm_cache_ws_desc",
        "llm_categorization_cache",
        ["workspace_id", "description_key"],
    )


def downgrade() -> None:
    op.drop_index("ix_llm_cache_ws_desc", table_name="llm_categorization_cache")
    op.drop_table("llm_categorization_cache")
