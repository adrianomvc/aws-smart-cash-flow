"""initial schema

Revision ID: 20260513_0001
Revises:
Create Date: 2026-05-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260513_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID_TYPE = sa.Uuid(as_uuid=False)
JSONB_TYPE = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID_TYPE, primary_key=True),
        sa.Column("supabase_user_id", UUID_TYPE, nullable=False, unique=True),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "workspaces",
        sa.Column("id", UUID_TYPE, primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "workspace_members",
        sa.Column("id", UUID_TYPE, primary_key=True),
        sa.Column("workspace_id", UUID_TYPE, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("user_id", UUID_TYPE, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("role in ('owner', 'admin', 'member')", name="ck_workspace_member_role"),
        sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),
    )
    op.create_table(
        "source_files",
        sa.Column("id", UUID_TYPE, primary_key=True),
        sa.Column("workspace_id", UUID_TYPE, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("original_filename", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("mime_type", sa.Text(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("storage_bucket", sa.Text(), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("source_kind", sa.String(length=32), nullable=False),
        sa.Column("created_by_user_id", UUID_TYPE, sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "source_kind in ('bank_statement_txt', 'credit_card_csv', 'unknown')",
            name="ck_source_file_source_kind",
        ),
        sa.UniqueConstraint("workspace_id", "content_hash", name="uq_source_file_workspace_hash"),
    )
    op.create_table(
        "import_jobs",
        sa.Column("id", UUID_TYPE, primary_key=True),
        sa.Column("workspace_id", UUID_TYPE, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("source_file_id", UUID_TYPE, sa.ForeignKey("source_files.id"), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valid_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "status in ('pending', 'processing', 'completed', 'completed_with_errors', 'failed', 'duplicate_file')",
            name="ck_import_job_status",
        ),
    )
    op.create_table(
        "raw_transaction_lines",
        sa.Column("id", UUID_TYPE, primary_key=True),
        sa.Column("workspace_id", UUID_TYPE, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("source_file_id", UUID_TYPE, sa.ForeignKey("source_files.id"), nullable=False),
        sa.Column("import_job_id", UUID_TYPE, sa.ForeignKey("import_jobs.id"), nullable=False),
        sa.Column("source_line", sa.Integer(), nullable=False),
        sa.Column("raw_payload", JSONB_TYPE, nullable=False),
        sa.Column("parse_status", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "parse_status in ('valid', 'invalid', 'skipped')",
            name="ck_raw_transaction_line_parse_status",
        ),
        sa.UniqueConstraint("import_job_id", "source_line", name="uq_raw_line_import_source_line"),
    )
    op.create_table(
        "transactions",
        sa.Column("id", UUID_TYPE, primary_key=True),
        sa.Column("workspace_id", UUID_TYPE, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("source_file_id", UUID_TYPE, sa.ForeignKey("source_files.id"), nullable=False),
        sa.Column("import_job_id", UUID_TYPE, sa.ForeignKey("import_jobs.id"), nullable=False),
        sa.Column(
            "raw_transaction_line_id",
            UUID_TYPE,
            sa.ForeignKey("raw_transaction_lines.id"),
            nullable=True,
        ),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_name", sa.Text(), nullable=True),
        sa.Column("account_or_card", sa.Text(), nullable=True),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("raw_description", sa.Text(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="BRL"),
        sa.Column("direction", sa.String(length=16), nullable=False),
        sa.Column("installment_current", sa.Integer(), nullable=True),
        sa.Column("installment_total", sa.Integer(), nullable=True),
        sa.Column("source_line", sa.Integer(), nullable=True),
        sa.Column("dedupe_key", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "source_type in ('bank_statement', 'credit_card_statement', 'unknown')",
            name="ck_transaction_source_type",
        ),
        sa.CheckConstraint(
            "direction in ('debit', 'credit', 'payment')",
            name="ck_transaction_direction",
        ),
        sa.UniqueConstraint("workspace_id", "dedupe_key", name="uq_transaction_dedupe"),
    )
    op.create_table(
        "import_errors",
        sa.Column("id", UUID_TYPE, primary_key=True),
        sa.Column("workspace_id", UUID_TYPE, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("import_job_id", UUID_TYPE, sa.ForeignKey("import_jobs.id"), nullable=False),
        sa.Column("source_line", sa.Integer(), nullable=True),
        sa.Column("field_name", sa.Text(), nullable=True),
        sa.Column("raw_value", sa.Text(), nullable=True),
        sa.Column("error_code", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "categories",
        sa.Column("id", UUID_TYPE, primary_key=True),
        sa.Column("workspace_id", UUID_TYPE, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "parent_category_id",
            UUID_TYPE,
            sa.ForeignKey("categories.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("workspace_id", "name", name="uq_category_workspace_name"),
    )
    op.create_table(
        "transaction_category_assignments",
        sa.Column("id", UUID_TYPE, primary_key=True),
        sa.Column("workspace_id", UUID_TYPE, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("transaction_id", UUID_TYPE, sa.ForeignKey("transactions.id"), nullable=False),
        sa.Column("category_id", UUID_TYPE, sa.ForeignKey("categories.id"), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 4), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("review_status", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "source in ('manual', 'rule', 'embedding', 'llm')",
            name="ck_transaction_category_assignment_source",
        ),
        sa.CheckConstraint(
            "review_status in ('accepted', 'pending', 'corrected')",
            name="ck_transaction_category_assignment_review_status",
        ),
        sa.UniqueConstraint(
            "transaction_id", name="uq_transaction_category_assignment_transaction"
        ),
    )
    op.create_table(
        "categorization_rules",
        sa.Column("id", UUID_TYPE, primary_key=True),
        sa.Column("workspace_id", UUID_TYPE, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("field", sa.String(length=32), nullable=False),
        sa.Column("match_type", sa.String(length=32), nullable=False),
        sa.Column("pattern", sa.Text(), nullable=False),
        sa.Column("category_id", UUID_TYPE, sa.ForeignKey("categories.id"), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "field in ('description', 'raw_description', 'source_name')",
            name="ck_categorization_rule_field",
        ),
        sa.CheckConstraint(
            "match_type in ('contains', 'starts_with', 'equals')",
            name="ck_categorization_rule_match_type",
        ),
    )


def downgrade() -> None:
    op.drop_table("categorization_rules")
    op.drop_table("transaction_category_assignments")
    op.drop_table("categories")
    op.drop_table("import_errors")
    op.drop_table("transactions")
    op.drop_table("raw_transaction_lines")
    op.drop_table("import_jobs")
    op.drop_table("source_files")
    op.drop_table("workspace_members")
    op.drop_table("workspaces")
    op.drop_table("users")
