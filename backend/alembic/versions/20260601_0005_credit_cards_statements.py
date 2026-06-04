"""Add credit cards and statements.

Revision ID: 20260601_0005
Revises: 20260531_0004
Create Date: 2026-06-01 03:10:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260601_0005"
down_revision: str | None = "20260531_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "credit_cards",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("issuer", sa.Text(), nullable=True),
        sa.Column("brand", sa.Text(), nullable=True),
        sa.Column("last_four", sa.String(length=4), nullable=True),
        sa.Column("closing_day", sa.Integer(), nullable=False),
        sa.Column("due_day", sa.Integer(), nullable=False),
        sa.Column("limit_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("closing_day >= 1 and closing_day <= 31", name="ck_credit_card_closing_day"),
        sa.CheckConstraint("due_day >= 1 and due_day <= 31", name="ck_credit_card_due_day"),
        sa.CheckConstraint(
            "limit_amount is null or limit_amount > 0",
            name="ck_credit_card_limit_amount_positive",
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.UniqueConstraint("workspace_id", "name", name="uq_credit_card_workspace_name"),
    )
    op.create_index("ix_credit_cards_workspace_active", "credit_cards", ["workspace_id", "active"])

    op.create_table(
        "credit_card_statements",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("credit_card_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("source_file_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("statement_month", sa.Date(), nullable=False),
        sa.Column("closing_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("total_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("status", sa.String(length=16), server_default="open", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "status in ('open', 'closed', 'paid', 'partial')",
            name="ck_credit_card_statement_status",
        ),
        sa.CheckConstraint(
            "total_amount is null or total_amount >= 0",
            name="ck_credit_card_statement_total_non_negative",
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.ForeignKeyConstraint(["credit_card_id"], ["credit_cards.id"]),
        sa.ForeignKeyConstraint(["source_file_id"], ["source_files.id"]),
        sa.UniqueConstraint("credit_card_id", "due_date", name="uq_credit_card_statement_due_date"),
    )
    op.create_index(
        "ix_credit_card_statements_workspace_due_date",
        "credit_card_statements",
        ["workspace_id", "due_date"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_credit_card_statements_workspace_due_date",
        table_name="credit_card_statements",
    )
    op.drop_table("credit_card_statements")
    op.drop_index("ix_credit_cards_workspace_active", table_name="credit_cards")
    op.drop_table("credit_cards")
