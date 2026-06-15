"""Add color to credit_cards."""

import sqlalchemy as sa

from alembic import op

revision = "20260613_0011"
down_revision = "20260612_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("credit_cards") as batch_op:
        batch_op.add_column(sa.Column("color", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("credit_cards") as batch_op:
        batch_op.drop_column("color")
