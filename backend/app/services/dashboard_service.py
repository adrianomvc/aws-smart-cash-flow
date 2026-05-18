from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.db.models import Category, ImportJob, Transaction, TransactionCategoryAssignment

ZERO = Decimal("0.00")


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
            key = (
                category.id if category is not None else None,
                category.name if category is not None else "Sem categoria",
            )
            totals[key]["category_id"] = key[0]
            totals[key]["category_name"] = key[1]
            totals[key]["amount"] = Decimal(totals[key]["amount"]) + abs(transaction.amount)
            totals[key]["count"] = int(totals[key]["count"]) + 1

        return sorted(
            totals.values(),
            key=lambda item: (Decimal(item["amount"]), int(item["count"])),
            reverse=True,
        )[:limit]

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
        filters: list[object] = [Transaction.workspace_id == workspace_id]
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
