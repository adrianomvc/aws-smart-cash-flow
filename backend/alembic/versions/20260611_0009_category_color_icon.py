"""Add color and icon to categories."""

import sqlalchemy as sa

from alembic import op

revision = "20260611_0009"
down_revision = "20260606_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("categories") as batch_op:
        batch_op.add_column(sa.Column("color", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("icon", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("categories") as batch_op:
        batch_op.drop_column("icon")
        batch_op.drop_column("color")
