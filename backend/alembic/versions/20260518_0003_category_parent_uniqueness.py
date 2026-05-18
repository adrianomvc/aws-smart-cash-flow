"""scope category names by parent

Revision ID: 20260518_0003
Revises: 20260518_0002
Create Date: 2026-05-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260518_0003"
down_revision: str | None = "20260518_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("categories") as batch_op:
        batch_op.drop_constraint("uq_category_workspace_name", type_="unique")
        batch_op.create_unique_constraint(
            "uq_category_workspace_parent_name",
            ["workspace_id", "parent_category_id", "name"],
        )


def downgrade() -> None:
    with op.batch_alter_table("categories") as batch_op:
        batch_op.drop_constraint("uq_category_workspace_parent_name", type_="unique")
        batch_op.create_unique_constraint(
            "uq_category_workspace_name",
            ["workspace_id", "name"],
        )
