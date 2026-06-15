"""Effective cash-out (payment) date for transactions.

Bank / unknown transactions are paid on the transaction (purchase) date itself.
Credit-card transactions are paid on the due date of the invoice that contains
the corresponding installment.
"""

from calendar import monthrange
from datetime import date

from app.core.config import settings


def _add_months(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 + months
    year = month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def _day_in_month(year: int, month: int, day: int) -> date:
    return date(year, month, min(day, monthrange(year, month)[1]))


def compute_payment_date(
    transaction_date: date,
    source_type: str,
    installment_current: int | None = None,
    closing_day: int | None = None,
    due_day: int | None = None,
) -> date:
    if source_type != "credit_card_statement":
        return transaction_date
    closing = closing_day or settings.default_credit_card_closing_day
    due = due_day or settings.default_credit_card_due_day
    if transaction_date.day <= closing:
        first_invoice = date(transaction_date.year, transaction_date.month, 1)
    else:
        first_invoice = _add_months(date(transaction_date.year, transaction_date.month, 1), 1)
    offset = (installment_current - 1) if installment_current else 0
    invoice_month = _add_months(first_invoice, offset)
    return _day_in_month(invoice_month.year, invoice_month.month, due)
