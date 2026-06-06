"""Categorization improvements: regex rules, amount_recurring, rule_id tracing, pg_trgm."""

from alembic import op
import sqlalchemy as sa

revision = "20260606_0008"
down_revision = "20260604_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # enable pg_trgm for text similarity (Stage 2a memory)
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # update match_type constraint to allow regex and amount_recurring
    op.drop_constraint("ck_categorization_rule_match_type", "categorization_rules")
    op.create_check_constraint(
        "ck_categorization_rule_match_type",
        "categorization_rules",
        "match_type in ('contains', 'starts_with', 'equals', 'regex', 'amount_recurring')",
    )

    # amount_recurring fields
    op.add_column("categorization_rules", sa.Column("amount_ref", sa.Numeric(14, 2), nullable=True))
    op.add_column("categorization_rules", sa.Column("amount_tolerance", sa.Numeric(14, 2), nullable=True))
    op.add_column("categorization_rules", sa.Column("day_min", sa.Integer(), nullable=True))
    op.add_column("categorization_rules", sa.Column("day_max", sa.Integer(), nullable=True))
    op.add_column("categorization_rules", sa.Column("direction_filter", sa.String(16), nullable=True))
    op.add_column("categorization_rules", sa.Column(
        "rule_id_origin",
        sa.String(36),
        sa.ForeignKey("categorization_rules.id"),
        nullable=True,
    ))
    op.create_check_constraint(
        "ck_categorization_rule_direction_filter",
        "categorization_rules",
        "direction_filter is null or direction_filter in ('debit', 'credit', 'payment')",
    )

    # pattern is now optional for amount_recurring — allow empty string (already Text, no change needed)

    # rule_id traceability on assignments
    op.add_column(
        "transaction_category_assignments",
        sa.Column("rule_id", sa.String(36), sa.ForeignKey("categorization_rules.id"), nullable=True),
    )

    # trgm index on transaction description for fast similarity search
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_transaction_description_trgm "
        "ON transactions USING gin (description gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_transaction_description_trgm")
    op.drop_column("transaction_category_assignments", "rule_id")
    op.drop_constraint("ck_categorization_rule_direction_filter", "categorization_rules")
    op.drop_column("categorization_rules", "rule_id_origin")
    op.drop_column("categorization_rules", "direction_filter")
    op.drop_column("categorization_rules", "day_max")
    op.drop_column("categorization_rules", "day_min")
    op.drop_column("categorization_rules", "amount_tolerance")
    op.drop_column("categorization_rules", "amount_ref")
    op.drop_constraint("ck_categorization_rule_match_type", "categorization_rules")
    op.create_check_constraint(
        "ck_categorization_rule_match_type",
        "categorization_rules",
        "match_type in ('contains', 'starts_with', 'equals')",
    )
