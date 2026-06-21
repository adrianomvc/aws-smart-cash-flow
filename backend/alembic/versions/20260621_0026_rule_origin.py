"""Track how a categorization rule was created (manual vs ai)."""

import sqlalchemy as sa

from alembic import op

revision = "20260621_0026"
down_revision = "20260621_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "categorization_rules",
        sa.Column("origin", sa.String(16), server_default="manual", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("categorization_rules", "origin")
