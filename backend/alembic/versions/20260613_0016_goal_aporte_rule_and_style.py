"""Add aporte auto-link rule and icon/color to goals."""

import sqlalchemy as sa

from alembic import op

revision = "20260613_0016"
down_revision = "20260613_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("goals") as batch_op:
        batch_op.add_column(sa.Column("aporte_match_text", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("aporte_min", sa.Numeric(14, 2), nullable=True))
        batch_op.add_column(sa.Column("aporte_max", sa.Numeric(14, 2), nullable=True))
        batch_op.add_column(sa.Column("color", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("icon", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("goals") as batch_op:
        batch_op.drop_column("icon")
        batch_op.drop_column("color")
        batch_op.drop_column("aporte_max")
        batch_op.drop_column("aporte_min")
        batch_op.drop_column("aporte_match_text")
