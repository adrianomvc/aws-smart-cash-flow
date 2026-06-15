"""Workspace invites and viewer role."""

import sqlalchemy as sa

from alembic import op

revision = "20260614_0021"
down_revision = "20260614_0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Allow the 'viewer' role on memberships.
    op.drop_constraint("ck_workspace_member_role", "workspace_members", type_="check")
    op.create_check_constraint(
        "ck_workspace_member_role",
        "workspace_members",
        "role in ('owner', 'admin', 'member', 'viewer')",
    )

    op.create_table(
        "workspace_invites",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.UniqueConstraint("workspace_id", "email", name="uq_workspace_invite"),
        sa.CheckConstraint("role in ('admin', 'member', 'viewer')", name="ck_workspace_invite_role"),
    )


def downgrade() -> None:
    op.drop_table("workspace_invites")
    op.drop_constraint("ck_workspace_member_role", "workspace_members", type_="check")
    op.create_check_constraint(
        "ck_workspace_member_role",
        "workspace_members",
        "role in ('owner', 'admin', 'member')",
    )
