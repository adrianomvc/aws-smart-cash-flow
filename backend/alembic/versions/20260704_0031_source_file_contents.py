"""Raw upload bytes, so the async import worker can re-read the file."""

import sqlalchemy as sa
from alembic import op

revision = "20260704_0031"
down_revision = "20260622_0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "source_file_contents",
        sa.Column(
            "source_file_id",
            sa.Uuid(as_uuid=False),
            sa.ForeignKey("source_files.id"),
            primary_key=True,
        ),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("source_file_contents")
