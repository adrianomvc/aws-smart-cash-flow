from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from app.db.models import Category, ImportJob, Transaction, TransactionCategoryAssignment

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

        return {
            "workspace_id": workspace_id,
            "date_from": date_from,
            "date_to": date_to,
            "income": income,
            "expenses": expenses,
            "payments": payments,
            "balance": balance,
            "savings_rate": savings_rate,
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
