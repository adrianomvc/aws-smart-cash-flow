"""Allow credit_card_pdf in the source_files source_kind check constraint."""

from alembic import op

revision = "20260617_0024"
down_revision = "20260615_0023"
branch_labels = None
depends_on = None

_NEW = (
    "source_kind in ('bank_statement_txt', 'bank_statement_excel', "
    "'credit_card_csv', 'credit_card_pdf', 'unknown')"
)
_OLD = (
    "source_kind in ('bank_statement_txt', 'bank_statement_excel', "
    "'credit_card_csv', 'unknown')"
)


def upgrade() -> None:
    with op.batch_alter_table("source_files") as batch_op:
        batch_op.drop_constraint("ck_source_file_source_kind", type_="check")
        batch_op.create_check_constraint("ck_source_file_source_kind", _NEW)


def downgrade() -> None:
    with op.batch_alter_table("source_files") as batch_op:
        batch_op.drop_constraint("ck_source_file_source_kind", type_="check")
        batch_op.create_check_constraint("ck_source_file_source_kind", _OLD)
