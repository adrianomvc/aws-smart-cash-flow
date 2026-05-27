from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import (
    Category,
    ImportJob,
    Transaction,
    TransactionCategoryAssignment,
)
from app.services.parsers import extract_installment, normalize_transaction_description

ZERO = Decimal("0.00")
WEEKDAY_NAMES = [
    "Segunda",
    "Terca",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sabado",
    "Domingo",
]


class DashboardService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def summary(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> dict[str, object]:
        transactions = self._transactions(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        income = self._sum(transactions, "credit")
        expenses = self._sum(transactions, "debit")
        payments = self._sum(transactions, "payment")
        balance = income - expenses
        savings_rate = (balance / income).quantize(Decimal("0.0001")) if income > ZERO else None
        commitment_rate = (expenses / income).quantize(Decimal("0.0001")) if income > ZERO else None
        burn_rate, burn_rate_months = self._burn_rate(workspace_id=workspace_id, date_to=date_to)

        return {
            "workspace_id": workspace_id,
            "date_from": date_from,
            "date_to": date_to,
            "income": income,
            "expenses": expenses,
            "payments": payments,
            "balance": balance,
            "savings_rate": savings_rate,
            "commitment_rate": commitment_rate,
            "burn_rate": burn_rate,
            "burn_rate_months": burn_rate_months,
            "burn_rate_basis": "trailing_12_month_average",
            "transaction_count": len(transactions),
        }

    def monthly_cashflow(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> list[dict[str, object]]:
        buckets: dict[str, dict[str, Decimal | str | int]] = {}
        for transaction in self._transactions(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        ):
            month = transaction.transaction_date.strftime("%Y-%m")
            bucket = buckets.setdefault(
                month,
                {
                    "month": month,
                    "income": ZERO,
                    "expenses": ZERO,
                    "payments": ZERO,
                    "balance": ZERO,
                    "transaction_count": 0,
                },
            )
            bucket["transaction_count"] = int(bucket["transaction_count"]) + 1
            if transaction.direction == "credit":
                bucket["income"] = Decimal(bucket["income"]) + transaction.amount
            elif transaction.direction == "debit":
                bucket["expenses"] = Decimal(bucket["expenses"]) + abs(transaction.amount)
            elif transaction.direction == "payment":
                bucket["payments"] = Decimal(bucket["payments"]) + abs(transaction.amount)
            bucket["balance"] = Decimal(bucket["income"]) - Decimal(bucket["expenses"])

        return [buckets[month] for month in sorted(buckets)]

    def category_ranking(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
        limit: int,
    ) -> list[dict[str, object]]:
        filters = self._transaction_filters(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        rows = self.db.execute(
            select(Transaction, Category)
            .outerjoin(
                TransactionCategoryAssignment,
                and_(
                    TransactionCategoryAssignment.transaction_id == Transaction.id,
                    TransactionCategoryAssignment.workspace_id == workspace_id,
                ),
            )
            .outerjoin(
                Category,
                and_(
                    Category.id == TransactionCategoryAssignment.category_id,
                    Category.workspace_id == workspace_id,
                ),
            )
            .where(*filters, Transaction.direction == "debit")
        ).all()
        categories_by_id = {
            category.id: category
            for category in self.db.scalars(
                select(Category).where(Category.workspace_id == workspace_id)
            ).all()
        }

        empty_category = {
            "category_id": None,
            "category_name": "Sem categoria",
            "amount": ZERO,
            "count": 0,
        }
        totals: dict[tuple[str | None, str], dict[str, object]] = defaultdict(
            lambda: empty_category.copy()
        )
        for transaction, category in rows:
            display_category = (
                categories_by_id.get(category.parent_category_id)
                if category is not None and category.parent_category_id is not None
                else category
            )
            key = (
                display_category.id if display_category is not None else None,
                display_category.name if display_category is not None else "Sem categoria",
            )
            totals[key]["category_id"] = key[0]
            totals[key]["category_name"] = key[1]
            totals[key]["amount"] = Decimal(totals[key]["amount"]) + abs(transaction.amount)
            totals[key]["count"] = int(totals[key]["count"]) + 1

        ranked = sorted(
            totals.values(),
            key=lambda item: (Decimal(item["amount"]), int(item["count"])),
            reverse=True,
        )
        total_amount = sum((Decimal(item["amount"]) for item in ranked), ZERO)
        for item in ranked:
            amount = Decimal(item["amount"])
            count = int(item["count"])
            item["share_ratio"] = (
                (amount / total_amount).quantize(Decimal("0.0001"))
                if total_amount > ZERO
                else None
            )
            item["average_amount"] = (
                (amount / Decimal(count)).quantize(Decimal("0.01")) if count else ZERO
            )
        return ranked[:limit]

    def merchant_ranking(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
        limit: int,
    ) -> list[dict[str, object]]:
        rows = self.db.execute(
            select(
                Transaction.description,
                func.sum(func.abs(Transaction.amount)),
                func.count(),
            )
            .where(
                *self._transaction_filters(
                    workspace_id=workspace_id,
                    date_from=date_from,
                    date_to=date_to,
                ),
                Transaction.direction == "debit",
            )
            .group_by(Transaction.description)
            .order_by(
                desc(func.sum(func.abs(Transaction.amount))),
                desc(func.count()),
                Transaction.description,
            )
            .limit(limit)
        ).all()
        return [
            {
                "description": description,
                "amount": Decimal(str(amount or ZERO)).quantize(Decimal("0.01")),
                "count": count,
            }
            for description, amount, count in rows
        ]

    def recurring_expenses(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
        min_months: int,
        limit: int,
    ) -> list[dict[str, object]]:
        rows = self.db.execute(
            select(Transaction, Category)
            .outerjoin(
                TransactionCategoryAssignment,
                and_(
                    TransactionCategoryAssignment.transaction_id == Transaction.id,
                    TransactionCategoryAssignment.workspace_id == workspace_id,
                ),
            )
            .outerjoin(
                Category,
                and_(
                    Category.id == TransactionCategoryAssignment.category_id,
                    Category.workspace_id == workspace_id,
                ),
            )
            .where(
                *self._transaction_filters(
                    workspace_id=workspace_id,
                    date_from=date_from,
                    date_to=date_to,
                ),
                Transaction.direction == "debit",
            )
            .order_by(Transaction.description, Transaction.transaction_date, Transaction.id)
        ).all()
        categories_by_id = {
            category.id: category
            for category in self.db.scalars(
                select(Category).where(Category.workspace_id == workspace_id)
            ).all()
        }
        grouped: dict[str, dict[str, object]] = {}
        for transaction, category in rows:
            item = grouped.setdefault(
                transaction.description,
                {
                    "description": transaction.description,
                    "amounts": [],
                    "months": set(),
                    "last_amount": ZERO,
                    "last_transaction_date": transaction.transaction_date,
                    "category_id": None,
                    "category_name": None,
                },
            )
            amounts = item["amounts"]
            months = item["months"]
            assert isinstance(amounts, list)
            assert isinstance(months, set)
            amounts.append(abs(transaction.amount))
            months.add(transaction.transaction_date.strftime("%Y-%m"))
            item["last_amount"] = abs(transaction.amount)
            item["last_transaction_date"] = transaction.transaction_date
            display_category = (
                categories_by_id.get(category.parent_category_id)
                if category is not None and category.parent_category_id is not None
                else category
            )
            if display_category is not None:
                item["category_id"] = display_category.id
                item["category_name"] = display_category.name

        recurring: list[dict[str, object]] = []
        for item in grouped.values():
            amounts = item["amounts"]
            months = item["months"]
            assert isinstance(amounts, list)
            assert isinstance(months, set)
            month_count = len(months)
            if month_count < min_months:
                continue
            average_amount = (sum(amounts, ZERO) / Decimal(len(amounts))).quantize(Decimal("0.01"))
            last_amount = Decimal(item["last_amount"]).quantize(Decimal("0.01"))
            change_ratio = (
                ((last_amount - average_amount) / average_amount).quantize(Decimal("0.0001"))
                if average_amount > ZERO
                else None
            )
            recurring.append(
                {
                    "description": item["description"],
                    "category_id": item["category_id"],
                    "category_name": item["category_name"],
                    "average_amount": average_amount,
                    "last_amount": last_amount,
                    "transaction_count": len(amounts),
                    "month_count": month_count,
                    "last_transaction_date": item["last_transaction_date"],
                    "change_ratio": change_ratio,
                    "status": "probable",
                }
            )

        return sorted(
            recurring,
            key=lambda item: (
                Decimal(item["average_amount"]),
                int(item["month_count"]),
                str(item["description"]),
            ),
            reverse=True,
        )[:limit]

    def category_growth_alerts(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
        limit: int,
    ) -> list[dict[str, object]]:
        if date_from is None or date_to is None or date_to < date_from:
            return []

        period_days = (date_to - date_from).days + 1
        previous_to = date_from - timedelta(days=1)
        previous_from = previous_to - timedelta(days=period_days - 1)
        current_totals = self.category_ranking(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
            limit=1000,
        )
        previous_totals = {
            item["category_id"]: item
            for item in self.category_ranking(
                workspace_id=workspace_id,
                date_from=previous_from,
                date_to=previous_to,
                limit=1000,
            )
        }

        alerts: list[dict[str, object]] = []
        for item in current_totals:
            category_id = item["category_id"]
            if category_id is None:
                continue
            previous = previous_totals.get(category_id)
            previous_amount = Decimal(previous["amount"]) if previous else ZERO
            current_amount = Decimal(item["amount"])
            change_amount = current_amount - previous_amount
            if previous_amount < Decimal("50.00") or current_amount < Decimal("100.00"):
                continue
            if change_amount < Decimal("50.00"):
                continue
            change_ratio = (change_amount / previous_amount).quantize(Decimal("0.0001"))
            if change_ratio < Decimal("0.3000"):
                continue
            alerts.append(
                {
                    "category_id": category_id,
                    "category_name": item["category_name"],
                    "current_amount": current_amount.quantize(Decimal("0.01")),
                    "previous_amount": previous_amount.quantize(Decimal("0.01")),
                    "change_amount": change_amount.quantize(Decimal("0.01")),
                    "change_ratio": change_ratio,
                    "current_count": item["count"],
                    "previous_count": previous["count"] if previous else 0,
                    "previous_date_from": previous_from,
                    "previous_date_to": previous_to,
                }
            )

        return sorted(
            alerts,
            key=lambda item: (Decimal(item["change_amount"]), Decimal(item["change_ratio"])),
            reverse=True,
        )[:limit]

    def weekday_spending(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> list[dict[str, object]]:
        buckets = {
            index: {
                "weekday": index,
                "weekday_name": WEEKDAY_NAMES[index],
                "amount": ZERO,
                "count": 0,
                "average_amount": ZERO,
                "share_ratio": None,
            }
            for index in range(7)
        }
        transactions = self._transactions(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        for transaction in transactions:
            if transaction.direction != "debit":
                continue
            bucket = buckets[transaction.transaction_date.weekday()]
            bucket["amount"] = Decimal(bucket["amount"]) + abs(transaction.amount)
            bucket["count"] = int(bucket["count"]) + 1

        total_amount = sum((Decimal(bucket["amount"]) for bucket in buckets.values()), ZERO)
        for bucket in buckets.values():
            amount = Decimal(bucket["amount"])
            count = int(bucket["count"])
            bucket["amount"] = amount.quantize(Decimal("0.01"))
            bucket["average_amount"] = (
                (amount / Decimal(count)).quantize(Decimal("0.01")) if count else ZERO
            )
            bucket["share_ratio"] = (
                (amount / total_amount).quantize(Decimal("0.0001"))
                if total_amount > ZERO
                else None
            )

        return list(buckets.values())

    def data_quality(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> dict[str, object]:
        transaction_filters = self._transaction_filters(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        total_transactions = self.db.scalar(
            select(func.count()).select_from(Transaction).where(*transaction_filters)
        )
        categorized_transactions = self.db.scalar(
            select(func.count())
            .select_from(Transaction)
            .join(
                TransactionCategoryAssignment,
                and_(
                    TransactionCategoryAssignment.transaction_id == Transaction.id,
                    TransactionCategoryAssignment.workspace_id == workspace_id,
                ),
            )
            .where(*transaction_filters)
        )
        imports_with_errors = self.db.scalar(
            select(func.count())
            .select_from(ImportJob)
            .where(
                ImportJob.workspace_id == workspace_id,
                ImportJob.error_rows > 0,
            )
        )
        duplicate_imports = self.db.scalar(
            select(func.count())
            .select_from(ImportJob)
            .where(
                ImportJob.workspace_id == workspace_id,
                ImportJob.status == "duplicate_file",
            )
        )
        categorized = int(categorized_transactions or 0)
        total = int(total_transactions or 0)
        uncategorized = total - categorized
        return {
            "workspace_id": workspace_id,
            "transaction_count": total,
            "categorized_count": categorized,
            "uncategorized_count": uncategorized,
            "categorized_ratio": (Decimal(categorized) / Decimal(total)).quantize(Decimal("0.0001"))
            if total
            else None,
            "imports_with_errors": int(imports_with_errors or 0),
            "duplicate_imports": int(duplicate_imports or 0),
        }

    def credit_card_payment_matches(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
        window_days: int,
        limit: int,
    ) -> list[dict[str, object]]:
        transactions = self._transactions(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        bank_payments = [
            transaction
            for transaction in transactions
            if transaction.direction == "payment" and transaction.source_type == "bank_statement"
        ]
        card_payments = [
            transaction
            for transaction in transactions
            if (
                transaction.direction == "payment"
                and transaction.source_type == "credit_card_statement"
            )
        ]
        matches: list[dict[str, object]] = []
        for bank_payment in bank_payments:
            for card_payment in card_payments:
                if abs(bank_payment.amount) != abs(card_payment.amount):
                    continue
                date_delta_days = abs(
                    (bank_payment.transaction_date - card_payment.transaction_date).days
                )
                if date_delta_days > window_days:
                    continue
                matches.append(
                    {
                        "bank_transaction_id": bank_payment.id,
                        "card_transaction_id": card_payment.id,
                        "amount": abs(bank_payment.amount),
                        "bank_date": bank_payment.transaction_date,
                        "card_date": card_payment.transaction_date,
                        "date_delta_days": date_delta_days,
                        "bank_description": bank_payment.description,
                        "card_description": card_payment.description,
                    }
                )
        return sorted(
            matches,
            key=lambda item: (
                int(item["date_delta_days"]),
                item["bank_date"],
                item["card_date"],
                item["amount"],
            ),
        )[:limit]

    def credit_card_installments(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
        limit: int,
    ) -> dict[str, object]:
        if date_from is not None and date_to is not None:
            return self._credit_card_installments_due(
                workspace_id=workspace_id,
                date_from=date_from,
                date_to=date_to,
                limit=limit,
            )

        filters = [
            Transaction.workspace_id == workspace_id,
            Transaction.natural_dedupe_key.is_not(None),
            Transaction.source_type == "credit_card_statement",
            Transaction.direction == "debit",
        ]
        if date_to is not None:
            filters.append(Transaction.transaction_date <= date_to)

        transactions = self.db.scalars(
            select(Transaction)
            .where(*filters)
            .order_by(desc(Transaction.transaction_date), Transaction.description, Transaction.id)
        ).all()
        grouped: dict[tuple[str, Decimal, int], dict[str, object]] = {}
        for transaction in transactions:
            installment_current = transaction.installment_current
            installment_total = transaction.installment_total
            if installment_current is None or installment_total is None:
                installment_current, installment_total = extract_installment(
                    transaction.raw_description
                )
            if not installment_current or not installment_total:
                continue
            if installment_current > installment_total:
                continue
            amount = abs(transaction.amount)
            description = normalize_transaction_description(transaction.raw_description)
            key = (description, amount, installment_total)
            current = grouped.get(key)
            if current is None:
                grouped[key] = {
                    "description": description,
                    "amount": amount,
                    "installment_total": installment_total,
                    "purchase_date": transaction.transaction_date,
                    "last_transaction_date": transaction.transaction_date,
                    "transaction_count": 1,
                }
            else:
                current["transaction_count"] = int(current["transaction_count"]) + 1
                if transaction.transaction_date < current["purchase_date"]:
                    current["purchase_date"] = transaction.transaction_date
                if transaction.transaction_date > current["last_transaction_date"]:
                    current["last_transaction_date"] = transaction.transaction_date

        items: list[dict[str, object]] = []
        total_future_amount = ZERO
        active_count = 0
        reference_date = self._next_month_reference(date_to) if date_to is not None else None
        for item in grouped.values():
            purchase_date = item["purchase_date"]
            target_year = reference_date.year if reference_date is not None else purchase_date.year
            target_month = (
                reference_date.month if reference_date is not None else purchase_date.month
            )
            current_installment = get_installment_for_target_month(
                purchase_date=purchase_date,
                total_installments=int(item["installment_total"]),
                target_year=target_year,
                target_month=target_month,
                closing_day=settings.default_credit_card_closing_day,
            )
            if current_installment is None:
                continue
            item["installment_current"] = current_installment
            item["first_invoice_month"] = get_first_invoice_month(
                purchase_date,
                settings.default_credit_card_closing_day,
            )
            del item["purchase_date"]
            remaining = max(int(item["installment_total"]) - current_installment, 0)
            future_amount = Decimal(item["amount"])
            item["remaining_installments"] = remaining
            item["future_amount"] = future_amount
            active_count += 1
            total_future_amount += future_amount
            items.append(item)

        items = sorted(
            items,
            key=lambda item: (
                -int(item["remaining_installments"]),
                -Decimal(item["future_amount"]),
                str(item["description"]),
            ),
        )
        return {
            "workspace_id": workspace_id,
            "active_count": active_count,
            "closing_day": settings.default_credit_card_closing_day,
            "due_day": settings.default_credit_card_due_day,
            "total_future_amount": total_future_amount,
            "items": items[:limit],
        }

    def _next_month_reference(self, date_to: date) -> date:
        if date_to.month == 12:
            return date(date_to.year + 1, 1, 1)
        return date(date_to.year, date_to.month + 1, 1)

    def _credit_card_installments_due(
        self,
        workspace_id: str,
        date_from: date,
        date_to: date,
        limit: int,
    ) -> dict[str, object]:
        rows = self.db.scalars(
            select(Transaction)
            .where(
                Transaction.workspace_id == workspace_id,
                Transaction.natural_dedupe_key.is_not(None),
                Transaction.source_type == "credit_card_statement",
                Transaction.direction == "debit",
            )
            .order_by(Transaction.description, Transaction.id)
        ).all()
        target_year = date_from.year
        target_month = date_from.month
        grouped: dict[tuple[str, Decimal, int, date], dict[str, object]] = {}
        for transaction in rows:
            current = transaction.installment_current
            total = transaction.installment_total
            if current is None or total is None:
                current, total = extract_installment(transaction.raw_description)
            if current is None or total is None or current > total:
                continue

            purchase_date = transaction.transaction_date
            installment_number = get_installment_for_target_month(
                purchase_date=purchase_date,
                total_installments=total,
                target_year=target_year,
                target_month=target_month,
                closing_day=settings.default_credit_card_closing_day,
            )
            if installment_number is None:
                continue

            amount = abs(transaction.amount)
            description = normalize_transaction_description(transaction.raw_description)
            key = (description, amount, int(total), purchase_date)
            first_invoice_month = get_first_invoice_month(
                purchase_date,
                settings.default_credit_card_closing_day,
            )
            if key not in grouped:
                grouped[key] = {
                    "description": description,
                    "amount": amount,
                    "installment_current": installment_number,
                    "installment_total": total,
                    "remaining_installments": max(total - installment_number, 0),
                    "future_amount": amount,
                    "first_invoice_month": first_invoice_month,
                    "last_transaction_date": purchase_date,
                    "transaction_count": 1,
                }
            else:
                grouped[key]["transaction_count"] = int(grouped[key]["transaction_count"]) + 1

        items = sorted(
            grouped.values(),
            key=lambda item: (
                str(item["description"]),
                item["last_transaction_date"],
                int(item["installment_total"]),
            ),
        )
        total_amount = sum((Decimal(item["future_amount"]) for item in items), ZERO)
        return {
            "workspace_id": workspace_id,
            "active_count": len(items),
            "closing_day": settings.default_credit_card_closing_day,
            "due_day": settings.default_credit_card_due_day,
            "total_future_amount": total_amount,
            "items": items[:limit],
        }

    def _transactions(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> list[Transaction]:
        return self.db.scalars(
            select(Transaction)
            .where(
                *self._transaction_filters(
                    workspace_id=workspace_id,
                    date_from=date_from,
                    date_to=date_to,
                )
            )
            .order_by(Transaction.transaction_date, Transaction.id)
        ).all()

    def _transaction_filters(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> list[object]:
        filters: list[object] = [
            Transaction.workspace_id == workspace_id,
            Transaction.natural_dedupe_key.is_not(None),
        ]
        if date_from is not None:
            filters.append(Transaction.transaction_date >= date_from)
        if date_to is not None:
            filters.append(Transaction.transaction_date <= date_to)
        return filters

    def _sum(self, transactions: list[Transaction], direction: str) -> Decimal:
        return sum(
            (
                abs(transaction.amount)
                for transaction in transactions
                if transaction.direction == direction
            ),
            ZERO,
        )

    def _burn_rate(self, workspace_id: str, date_to: date | None) -> tuple[Decimal, int]:
        anchor = date_to or self._latest_transaction_date(workspace_id)
        if anchor is None:
            return ZERO, 0
        window_start = _add_months(date(anchor.year, anchor.month, 1), -11)
        debits = self._transactions(
            workspace_id=workspace_id,
            date_from=window_start,
            date_to=anchor,
        )
        expenses = self._sum(debits, "debit")
        debit_months = [
            transaction.transaction_date
            for transaction in debits
            if transaction.direction == "debit"
        ]
        if not debit_months:
            return ZERO, 0
        first_month = date(min(debit_months).year, min(debit_months).month, 1)
        months = min(12, _inclusive_months(first_month, anchor))
        burn_rate = (expenses / Decimal(months)).quantize(Decimal("0.01")) if months else ZERO
        return burn_rate, months

    def _latest_transaction_date(self, workspace_id: str) -> date | None:
        return self.db.scalar(
            select(func.max(Transaction.transaction_date)).where(
                Transaction.workspace_id == workspace_id,
                Transaction.natural_dedupe_key.is_not(None),
            )
        )


def _inclusive_months(date_from: date, date_to: date) -> int:
    if date_to < date_from:
        return 0
    return (date_to.year - date_from.year) * 12 + date_to.month - date_from.month + 1


def _add_months(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 + months
    year = month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def get_first_invoice_month(purchase_date: date, closing_day: int) -> date:
    if purchase_date.day <= closing_day:
        return date(purchase_date.year, purchase_date.month, 1)
    return _add_months(date(purchase_date.year, purchase_date.month, 1), 1)


def get_installment_for_target_month(
    purchase_date: date,
    total_installments: int,
    target_year: int,
    target_month: int,
    closing_day: int,
) -> int | None:
    first_invoice_month = get_first_invoice_month(purchase_date, closing_day)
    target_invoice_month = date(target_year, target_month, 1)
    months_diff = (
        (target_invoice_month.year - first_invoice_month.year) * 12
        + target_invoice_month.month
        - first_invoice_month.month
    )
    installment_number = months_diff + 1
    if installment_number < 1 or installment_number > total_installments:
        return None
    return installment_number
