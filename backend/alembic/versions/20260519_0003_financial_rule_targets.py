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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("categorization_rules")}
    check_constraints = {
        constraint["name"]
        for constraint in inspector.get_check_constraints("categorization_rules")
    }

    with op.batch_alter_table("categorization_rules") as batch_op:
        if "target_direction" not in columns:
            batch_op.add_column(sa.Column("target_direction", sa.String(length=16), nullable=True))
        batch_op.alter_column("category_id", existing_type=sa.CHAR(length=32), nullable=True)
        if "ck_categorization_rule_target_direction" not in check_constraints:
            batch_op.create_check_constraint(
                "ck_categorization_rule_target_direction",
                "target_direction is null or target_direction in ('debit', 'credit', 'payment')",
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("categorization_rules")}
    check_constraints = {
        constraint["name"]
        for constraint in inspector.get_check_constraints("categorization_rules")
    }

    with op.batch_alter_table("categorization_rules") as batch_op:
        if "ck_categorization_rule_target_direction" in check_constraints:
            batch_op.drop_constraint(
                "ck_categorization_rule_target_direction",
                type_="check",
            )
        batch_op.alter_column("category_id", existing_type=sa.CHAR(length=32), nullable=False)
        if "target_direction" in columns:
            batch_op.drop_column("target_direction")
