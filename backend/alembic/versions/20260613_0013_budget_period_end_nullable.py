"""Make budget period_end nullable (recurring budgets may have no end)."""

import sqlalchemy as sa

from alembic import op

revision = "20260613_0013"
down_revision = "20260613_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("budgets") as batch_op:
        batch_op.alter_column("period_end", existing_type=sa.Date(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("budgets") as batch_op:
        batch_op.alter_column("period_end", existing_type=sa.Date(), nullable=False)
