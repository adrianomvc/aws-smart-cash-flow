"""Add recurring flag to budgets."""

import sqlalchemy as sa

from alembic import op

revision = "20260613_0012"
down_revision = "20260613_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("budgets") as batch_op:
        batch_op.add_column(
            sa.Column("recurring", sa.Boolean(), nullable=False, server_default="false")
        )


def downgrade() -> None:
    with op.batch_alter_table("budgets") as batch_op:
        batch_op.drop_column("recurring")
