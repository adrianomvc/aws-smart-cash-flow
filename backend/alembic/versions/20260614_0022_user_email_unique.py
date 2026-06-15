"""Unique constraint on user email (one email = one user)."""

from alembic import op

revision = "20260614_0022"
down_revision = "20260614_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("uq_users_email", "users", ["email"])


def downgrade() -> None:
    op.drop_constraint("uq_users_email", "users", type_="unique")
