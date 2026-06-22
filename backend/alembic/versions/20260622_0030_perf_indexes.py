"""Composite indexes for the hot analytics filters (reduce query cost on Neon)."""

from alembic import op

revision = "20260622_0030"
down_revision = "20260621_0026"
branch_labels = None
depends_on = None

_INDEXES = [
    ("ix_transactions_workspace_date", "transactions (workspace_id, transaction_date)"),
    ("ix_transactions_workspace_payment_date", "transactions (workspace_id, payment_date)"),
    ("ix_transactions_workspace_direction_date", "transactions (workspace_id, direction, transaction_date)"),
    ("ix_transactions_workspace_source_file", "transactions (workspace_id, source_file_id)"),
    ("ix_transactions_workspace_import_job", "transactions (workspace_id, import_job_id)"),
    ("ix_assignments_workspace_transaction", "transaction_category_assignments (workspace_id, transaction_id)"),
    ("ix_assignments_workspace_category", "transaction_category_assignments (workspace_id, category_id)"),
    ("ix_categories_workspace_parent", "categories (workspace_id, parent_category_id)"),
    ("ix_import_jobs_workspace_created", "import_jobs (workspace_id, created_at)"),
    ("ix_source_files_workspace_received", "source_files (workspace_id, received_at)"),
]


def upgrade() -> None:
    for name, target in _INDEXES:
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {target}")


def downgrade() -> None:
    for name, _ in _INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
