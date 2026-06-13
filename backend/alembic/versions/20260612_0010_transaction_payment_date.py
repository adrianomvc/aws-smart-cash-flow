"""Add payment_date to transactions and backfill it."""

import sqlalchemy as sa

from alembic import op

revision = "20260612_0010"
down_revision = "20260611_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("payment_date", sa.Date(), nullable=True))
    bind = op.get_bind()
    # Bank / unknown transactions are paid on the transaction date itself.
    bind.execute(
        sa.text(
            "UPDATE transactions SET payment_date = transaction_date "
            "WHERE source_type <> 'credit_card_statement'"
        )
    )
    # Credit-card transactions: due date of the invoice that holds the installment.
    from app.services.billing_dates import compute_payment_date

    rows = bind.execute(
        sa.text(
            "SELECT id, transaction_date, installment_current FROM transactions "
            "WHERE source_type = 'credit_card_statement'"
        )
    ).fetchall()
    for row in rows:
        payment_date = compute_payment_date(
            row.transaction_date, "credit_card_statement", row.installment_current
        )
        bind.execute(
            sa.text("UPDATE transactions SET payment_date = :pd WHERE id = :id"),
            {"pd": payment_date, "id": row.id},
        )


def downgrade() -> None:
    op.drop_column("transactions", "payment_date")
