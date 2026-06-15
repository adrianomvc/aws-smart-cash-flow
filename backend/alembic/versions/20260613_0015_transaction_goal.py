"""Link transactions to goals (contributions/aportes)."""

import sqlalchemy as sa

from alembic import op

revision = "20260613_0015"
down_revision = "20260613_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.add_column(sa.Column("goal_id", sa.Uuid(as_uuid=False), nullable=True))
        batch_op.create_index("ix_transactions_goal_id", ["goal_id"])
        batch_op.create_foreign_key(
            "fk_transactions_goal_id", "goals", ["goal_id"], ["id"], ondelete="SET NULL"
        )


def downgrade() -> None:
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_constraint("fk_transactions_goal_id", type_="foreignkey")
        batch_op.drop_index("ix_transactions_goal_id")
        batch_op.drop_column("goal_id")
