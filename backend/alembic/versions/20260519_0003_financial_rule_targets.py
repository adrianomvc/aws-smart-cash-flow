"""add financial targets to categorization rules

Revision ID: 20260519_0003
Revises: 20260518_0002
Create Date: 2026-05-19
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260519_0003"
down_revision: str | None = "20260518_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "categorization_rules",
        sa.Column("target_direction", sa.String(length=16), nullable=True),
    )
    op.alter_column("categorization_rules", "category_id", nullable=True)
    op.create_check_constraint(
        "ck_categorization_rule_target_direction",
        "categorization_rules",
        "target_direction is null or target_direction in ('debit', 'credit', 'payment')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_categorization_rule_target_direction",
        "categorization_rules",
        type_="check",
    )
    op.alter_column("categorization_rules", "category_id", nullable=False)
    op.drop_column("categorization_rules", "target_direction")
