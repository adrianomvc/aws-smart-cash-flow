"""Card identity by BIN + last_four reissue history.

A reissued card keeps the same BIN (masked PAN prefix) but gets a new last_four.
`bin` becomes the stable match key; `previous_last_four` records the old plastics.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260711_0032"
down_revision = "20260704_0031"
branch_labels = None
depends_on = None

JSONB_TYPE = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.add_column("credit_cards", sa.Column("bin", sa.String(length=8), nullable=True))
    op.add_column(
        "credit_cards",
        sa.Column("previous_last_four", JSONB_TYPE, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("credit_cards", "previous_last_four")
    op.drop_column("credit_cards", "bin")
