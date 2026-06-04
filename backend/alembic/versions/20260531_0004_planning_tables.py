"""add planning tables

Revision ID: 20260531_0004
Revises: 20260519_0003
Create Date: 2026-05-31
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260531_0004"
down_revision: str | None = "20260519_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "financial_calendar_events",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("event_type", sa.String(length=24), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("recurrence", sa.String(length=16), server_default="none", nullable=False),
        sa.Column("status", sa.String(length=16), server_default="planned", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "event_type in ('income', 'expense', 'card_payment', 'subscription', 'goal', 'other')",
            name="ck_financial_calendar_event_type",
        ),
        sa.CheckConstraint(
            "status in ('planned', 'paid', 'skipped')",
            name="ck_financial_calendar_event_status",
        ),
        sa.CheckConstraint(
            "recurrence in ('none', 'monthly')",
            name="ck_financial_calendar_event_recurrence",
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
    )
    op.create_index(
        "ix_financial_calendar_events_workspace_due_date",
        "financial_calendar_events",
        ["workspace_id", "due_date"],
    )

    op.create_table(
        "budgets",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("category_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("limit_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("alert_threshold", sa.Numeric(5, 4), server_default="0.8500", nullable=False),
        sa.Column("active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("limit_amount > 0", name="ck_budget_limit_amount_positive"),
        sa.CheckConstraint(
            "alert_threshold > 0 and alert_threshold <= 1",
            name="ck_budget_alert_threshold_range",
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
    )
    op.create_index("ix_budgets_workspace_period", "budgets", ["workspace_id", "period_start", "period_end"])

    op.create_table(
        "goals",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("current_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=16), server_default="active", nullable=False),
        sa.Column("priority", sa.Integer(), server_default="100", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("target_amount > 0", name="ck_goal_target_amount_positive"),
        sa.CheckConstraint("current_amount >= 0", name="ck_goal_current_amount_non_negative"),
        sa.CheckConstraint("status in ('active', 'paused', 'completed')", name="ck_goal_status"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
    )
    op.create_index("ix_goals_workspace_status_priority", "goals", ["workspace_id", "status", "priority"])


def downgrade() -> None:
    op.drop_index("ix_goals_workspace_status_priority", table_name="goals")
    op.drop_table("goals")
    op.drop_index("ix_budgets_workspace_period", table_name="budgets")
    op.drop_table("budgets")
    op.drop_index(
        "ix_financial_calendar_events_workspace_due_date",
        table_name="financial_calendar_events",
    )
    op.drop_table("financial_calendar_events")
