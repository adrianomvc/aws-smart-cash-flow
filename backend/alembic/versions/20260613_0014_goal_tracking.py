"""Add tracking mode and linked account to goals."""

import sqlalchemy as sa

from alembic import op

revision = "20260613_0014"
down_revision = "20260613_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("goals") as batch_op:
        batch_op.add_column(
            sa.Column("tracking_mode", sa.String(length=16), nullable=False, server_default="manual")
        )
        batch_op.add_column(sa.Column("linked_account", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("goals") as batch_op:
        batch_op.drop_column("linked_account")
        batch_op.drop_column("tracking_mode")
