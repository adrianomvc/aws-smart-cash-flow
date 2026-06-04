"""Add account balances imported from Excel statements."""

import sqlalchemy as sa

from alembic import op

revision = "20260602_0006"
down_revision = "20260601_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "account_balances",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("source_file_id", sa.Uuid(as_uuid=False), sa.ForeignKey("source_files.id"), nullable=False),
        sa.Column("import_job_id", sa.Uuid(as_uuid=False), sa.ForeignKey("import_jobs.id"), nullable=False),
        sa.Column("account_name", sa.Text(), nullable=False),
        sa.Column("balance_date", sa.Date(), nullable=False),
        sa.Column("balance_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("source_line", sa.Integer(), nullable=False),
        sa.Column("raw_payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint(
            "workspace_id",
            "account_name",
            "balance_date",
            name="uq_account_balance_workspace_account_date",
        ),
    )
    with op.batch_alter_table("source_files") as batch_op:
        batch_op.drop_constraint("ck_source_file_source_kind", type_="check")
        batch_op.create_check_constraint(
            "ck_source_file_source_kind",
            "source_kind in ('bank_statement_txt', 'bank_statement_excel', 'credit_card_csv', 'unknown')",
        )


def downgrade() -> None:
    with op.batch_alter_table("source_files") as batch_op:
        batch_op.drop_constraint("ck_source_file_source_kind", type_="check")
        batch_op.create_check_constraint(
            "ck_source_file_source_kind",
            "source_kind in ('bank_statement_txt', 'credit_card_csv', 'unknown')",
        )
    op.drop_table("account_balances")
