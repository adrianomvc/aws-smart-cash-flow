"""Add performance indexes for common query patterns."""

from alembic import op

revision = "20260604_0007"
down_revision = "20260602_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_transaction_workspace_direction_date",
        "transactions",
        ["workspace_id", "direction", "transaction_date"],
    )
    op.create_index(
        "ix_transaction_workspace_source_type",
        "transactions",
        ["workspace_id", "source_type"],
    )
    op.create_index(
        "ix_account_balance_workspace_date",
        "account_balances",
        ["workspace_id", "balance_date"],
    )
    op.create_index(
        "ix_financial_calendar_event_workspace_due",
        "financial_calendar_events",
        ["workspace_id", "due_date"],
    )
    op.create_index(
        "ix_import_job_workspace",
        "import_jobs",
        ["workspace_id"],
    )
    op.create_index(
        "ix_import_error_workspace",
        "import_errors",
        ["workspace_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_import_error_workspace", table_name="import_errors")
    op.drop_index("ix_import_job_workspace", table_name="import_jobs")
    op.drop_index("ix_financial_calendar_event_workspace_due", table_name="financial_calendar_events")
    op.drop_index("ix_account_balance_workspace_date", table_name="account_balances")
    op.drop_index("ix_transaction_workspace_source_type", table_name="transactions")
    op.drop_index("ix_transaction_workspace_direction_date", table_name="transactions")
