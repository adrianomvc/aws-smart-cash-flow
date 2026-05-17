"""make category names unique per parent

Revision ID: 20260517_0002
Revises: 20260513_0001
Create Date: 2026-05-17
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260517_0002"
down_revision: str | None = "20260513_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_category_workspace_name", "categories", type_="unique")
    op.create_index(
        "uq_category_workspace_root_name",
        "categories",
        ["workspace_id", "name"],
        unique=True,
        postgresql_where=sa.text("parent_category_id IS NULL"),
    )
    op.create_index(
        "uq_category_workspace_parent_name",
        "categories",
        ["workspace_id", "parent_category_id", "name"],
        unique=True,
        postgresql_where=sa.text("parent_category_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_category_workspace_parent_name", table_name="categories")
    op.drop_index("uq_category_workspace_root_name", table_name="categories")
    op.create_unique_constraint(
        "uq_category_workspace_name",
        "categories",
        ["workspace_id", "name"],
    )
