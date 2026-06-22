import re
from calendar import monthrange
from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import and_, case, desc, func, or_, select
from sqlalchemy.orm import Session, aliased

from app.core.config import settings
from app.db.models import (
    AccountBalance,
    Category,
    CreditCardStatement,
    FinancialCalendarEvent,
    ImportJob,
    SourceFile,
    Transaction,
    TransactionCategoryAssignment,
    WorkspacePreferences,
)
from app.services.parsers import extract_installment, normalize_transaction_description

ZERO = Decimal("0.00")
ONE = Decimal("1")
NEG_ONE = Decimal("-1")

# Spending breakdown: transaction-size buckets (P/M/G/GG) in BRL. Tweak freely.
_SIZE_BUCKETS = [
    ("P", "Pequeno", "Até R$ 50", ZERO, Decimal("50")),
    ("M", "Médio", "R$ 50–250", Decimal("50"), Decimal("250")),
    ("G", "Grande", "R$ 250–1.000", Decimal("250"), Decimal("1000")),
    ("GG", "Gigante", "Acima de R$ 1.000", Decimal("1000"), None),
]
# "Fixed" cost = same description recurring in >= N distinct months with a
# stable amount (coefficient of variation <= threshold). Everything else is
# "variable". Detection runs over a trailing 6-month window.
_FIXED_MIN_MONTHS = 3
_FIXED_MAX_CV = 0.20
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
        # Totals per direction in SQL (a handful of rows) instead of pulling every
        # transaction of the period to Python just to sum and count them.
        direction_rows = self.db.execute(
            select(
                Transaction.direction,
                func.sum(func.abs(Transaction.amount)).label("total"),
                func.count().label("cnt"),
            )
            .where(
                *self._transaction_filters(
                    workspace_id=workspace_id,
                    date_from=date_from,
                    date_to=date_to,
                )
            )
            .group_by(Transaction.direction)
        ).all()
        sums = {
            row.direction: Decimal(str(row.total or 0)).quantize(Decimal("0.01"))
            for row in direction_rows
        }
        income = sums.get("credit", ZERO)
        expenses = sums.get("debit", ZERO)
        payments = sums.get("payment", ZERO)
        transaction_count = sum(int(row.cnt or 0) for row in direction_rows)
        balance = income - expenses
        savings_rate = (balance / income).quantize(Decimal("0.0001")) if income > ZERO else None
        commitment_rate = (expenses / income).quantize(Decimal("0.0001")) if income > ZERO else None
        prefs = self._preferences(workspace_id)
        window_months = prefs.burn_rate_window_months if prefs else 12
        commitment_limit = prefs.commitment_limit_pct if prefs else Decimal("0.3500")
        savings_target = prefs.savings_target_pct if prefs else Decimal("0.2000")
        protected_reserve = prefs.protected_reserve if prefs else ZERO

        burn_rate, burn_rate_months = self._burn_rate(workspace_id=workspace_id, date_to=date_to)
        burn_rate_90_days, burn_rate_90_days_window = self._burn_rate_90_days(
            workspace_id=workspace_id,
            date_to=date_to,
        )
        # Preference-driven burn rate (window) is the headline figure.
        burn_rate_effective = self._burn_rate_window(
            workspace_id=workspace_id, date_to=date_to, months=window_months
        )
        current_balance = self._current_account_balance(workspace_id=workspace_id, date_to=date_to)
        # The protected reserve (preference) overrides the default 90-day reserve.
        reserve = protected_reserve if protected_reserve > ZERO else burn_rate_90_days
        safe_spend, safe_spend_reserve = self._safe_spend(
            workspace_id=workspace_id,
            date_to=date_to,
            current_balance=current_balance.balance_amount if current_balance else None,
            reserve_minimum=reserve,
        )
        financial_health_score = self._financial_health_score(
            commitment_rate=commitment_rate,
            current_balance=current_balance.balance_amount if current_balance else None,
            income=income,
            savings_rate=savings_rate,
            safe_spend=safe_spend,
            burn_rate=burn_rate_90_days if burn_rate_90_days > ZERO else burn_rate,
        )

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
            "burn_rate": burn_rate_effective if burn_rate_effective > ZERO else burn_rate,
            "burn_rate_months": window_months,
            "burn_rate_basis": f"trailing_{window_months}_month_monthly_equivalent",
            "burn_rate_90_days": burn_rate_90_days,
            "burn_rate_90_days_window": burn_rate_90_days_window,
            "burn_rate_90_days_basis": "trailing_90_days_monthly_equivalent",
            "safe_spend": safe_spend,
            "safe_spend_reserve_minimum": safe_spend_reserve,
            "safe_spend_basis": (
                "next_30_days_with_protected_reserve"
                if protected_reserve > ZERO
                else "next_30_days_with_90_day_burn_rate_reserve"
            ),
            "financial_health_score": financial_health_score,
            "financial_health_basis": "runway_saving_commitment_safe_spend_balance",
            "transaction_count": transaction_count,
            "current_balance": current_balance.balance_amount if current_balance else None,
            "current_balance_date": current_balance.balance_date if current_balance else None,
            "current_balance_account": current_balance.account_name if current_balance else None,
            "commitment_limit": commitment_limit,
            "commitment_over_limit": bool(
                commitment_rate is not None and commitment_rate > commitment_limit
            ),
            "savings_target": savings_target,
            "savings_on_target": bool(
                savings_rate is not None and savings_rate >= savings_target
            ),
            "protected_reserve": protected_reserve,
            "burn_rate_window_months": window_months,
        }

    def monthly_cashflow(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> list[dict[str, object]]:
        buckets: dict[str, dict[str, Decimal | str | int]] = {}
        opening_balance = self._opening_account_balance(
            workspace_id=workspace_id,
            date_from=date_from,
        )
        running_balance = opening_balance
        transactions = self._cashflow_transactions(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        source_file_due_dates = self._source_file_statement_due_dates(transactions)
        month_balances = self._account_balances_by_month(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        for transaction in transactions:
            cashflow_date = self._cashflow_date(
                transaction,
                source_file_due_dates.get(transaction.source_file_id),
            )
            if not _date_in_range(cashflow_date, date_from, date_to):
                continue
            month = cashflow_date.strftime("%Y-%m")
            bucket = buckets.setdefault(
                month,
                {
                    "month": month,
                    "income": ZERO,
                    "expenses": ZERO,
                    "payments": ZERO,
                    "balance": ZERO,
                    "opening_balance": ZERO,
                    "closing_balance": ZERO,
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

        items: list[dict[str, object]] = []
        for month in sorted(buckets):
            bucket = buckets[month]
            bucket["opening_balance"] = running_balance
            running_balance = (
                month_balances[month]
                if month in month_balances
                else running_balance + Decimal(bucket["balance"])
            )
            bucket["closing_balance"] = running_balance
            items.append(bucket)
        return items

    def daily_cashflow(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> list[dict[str, object]]:
        transactions = self._cashflow_transactions(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        source_file_due_dates = self._source_file_statement_due_dates(transactions)
        buckets: dict[date, dict[str, Decimal | date | int]] = {}
        account_balances = self._account_balances_by_date(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        for transaction in transactions:
            cashflow_date = self._cashflow_date(
                transaction,
                source_file_due_dates.get(transaction.source_file_id),
            )
            if not _date_in_range(cashflow_date, date_from, date_to):
                continue
            bucket = buckets.setdefault(
                cashflow_date,
                {
                    "date": cashflow_date,
                    "income": ZERO,
                    "expenses": ZERO,
                    "payments": ZERO,
                    "balance": ZERO,
                    "opening_balance": ZERO,
                    "closing_balance": ZERO,
                    "transaction_count": 0,
                },
            )
            bucket["transaction_count"] = int(bucket["transaction_count"]) + 1
            if transaction.direction == "credit":
                bucket["income"] = Decimal(bucket["income"]) + abs(transaction.amount)
            elif transaction.direction == "debit":
                bucket["expenses"] = Decimal(bucket["expenses"]) + abs(transaction.amount)
            elif transaction.direction == "payment":
                bucket["payments"] = Decimal(bucket["payments"]) + abs(transaction.amount)
            bucket["balance"] = Decimal(bucket["income"]) - Decimal(bucket["expenses"])

        if date_from is None and date_to is None:
            days = sorted(buckets)
        else:
            start = date_from or (min(buckets) if buckets else date_to)
            end = date_to or (max(buckets) if buckets else date_from)
            if start is None or end is None or start > end:
                days = []
            else:
                day_count = (end - start).days + 1
                days = [start + timedelta(days=offset) for offset in range(day_count)]

        running_balance = self._opening_account_balance(
            workspace_id=workspace_id,
            date_from=days[0] if days else date_from,
        )
        items: list[dict[str, object]] = []
        for day in days:
            bucket = buckets.get(
                day,
                {
                    "date": day,
                    "income": ZERO,
                    "expenses": ZERO,
                    "payments": ZERO,
                    "balance": ZERO,
                    "opening_balance": ZERO,
                    "closing_balance": ZERO,
                    "transaction_count": 0,
                },
            )
            bucket["opening_balance"] = running_balance
            running_balance = account_balances.get(
                day,
                running_balance + Decimal(bucket["balance"]),
            )
            bucket["closing_balance"] = running_balance
            items.append(bucket)
        return items

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
        # Aggregate in SQL (one small row per displayed category) instead of pulling
        # every debit transaction to Python. The displayed category is the parent
        # when the assignment points to a subcategory, else the category itself.
        parent = aliased(Category)
        display_id = func.coalesce(parent.id, Category.id)
        display_name = func.coalesce(parent.name, Category.name)
        display_color = func.coalesce(parent.color, Category.color)
        display_icon = func.coalesce(parent.icon, Category.icon)
        rows = self.db.execute(
            select(
                display_id.label("category_id"),
                display_name.label("category_name"),
                display_color.label("color"),
                display_icon.label("icon"),
                func.sum(func.abs(Transaction.amount)).label("amount"),
                func.count().label("count"),
                func.max(Transaction.transaction_date).label("last_transaction_date"),
            )
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
            .outerjoin(
                parent,
                and_(
                    parent.id == Category.parent_category_id,
                    parent.workspace_id == workspace_id,
                ),
            )
            .where(*filters, Transaction.direction == "debit")
            .group_by(display_id, display_name, display_color, display_icon)
        ).all()

        ranked: list[dict[str, object]] = [
            {
                "category_id": row.category_id,
                "category_name": row.category_name or "Sem categoria",
                "color": row.color,
                "icon": row.icon,
                "amount": Decimal(str(row.amount or 0)).quantize(Decimal("0.01")),
                "count": int(row.count or 0),
                "last_transaction_date": row.last_transaction_date,
            }
            for row in rows
        ]
        ranked.sort(
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

    def subcategory_ranking(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
        category_id: str | None,
        limit: int,
    ) -> list[dict[str, object]]:
        filters = self._transaction_filters(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        # SQL aggregation: group by the assigned (sub)category; the displayed parent
        # id and the subcategory label are derived in SQL (parent self-join).
        parent = aliased(Category)
        parent_id = func.coalesce(parent.id, Category.id)
        subcategory_name = case(
            (Category.id.is_(None), "Sem categoria / Sem subcategoria"),
            (Category.parent_category_id.is_(None), "Sem subcategoria"),
            else_=Category.name,
        )
        parent_color = func.coalesce(parent.color, Category.color)
        query = (
            select(
                Category.id.label("sub_id"),
                parent_id.label("category_id"),
                subcategory_name.label("subcategory_name"),
                parent_color.label("color"),
                func.sum(func.abs(Transaction.amount)).label("amount"),
                func.count().label("count"),
            )
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
            .outerjoin(
                parent,
                and_(
                    parent.id == Category.parent_category_id,
                    parent.workspace_id == workspace_id,
                ),
            )
            .where(*filters, Transaction.direction == "debit")
            .group_by(Category.id, parent_id, subcategory_name, parent_color)
        )
        if category_id is not None:
            query = query.where(parent_id == category_id)
        rows = self.db.execute(query).all()
        ranked: list[dict[str, object]] = [
            {
                "category_id": row.category_id,
                "subcategory_name": row.subcategory_name,
                "color": row.color,
                "amount": Decimal(str(row.amount or 0)).quantize(Decimal("0.01")),
                "count": int(row.count or 0),
            }
            for row in rows
        ]
        ranked.sort(
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

    def expense_size_profile(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> list[dict[str, object]]:
        # Bucket debits by size in SQL (5 rows) instead of pulling every debit.
        abs_amount = func.abs(Transaction.amount)
        bucket = case(
            (abs_amount <= Decimal("50.00"), "cotidiana"),
            (abs_amount <= Decimal("200.00"), "pequena"),
            (abs_amount <= Decimal("1000.00"), "media"),
            (abs_amount <= Decimal("5000.00"), "alta"),
            else_="premium",
        )
        rows = self.db.execute(
            select(
                bucket.label("bucket"),
                func.sum(abs_amount).label("total"),
                func.count().label("cnt"),
            )
            .where(
                *self._transaction_filters(
                    workspace_id=workspace_id,
                    date_from=date_from,
                    date_to=date_to,
                ),
                Transaction.direction == "debit",
                abs_amount > 0,
            )
            .group_by(bucket)
        ).all()
        by_bucket = {
            row.bucket: (Decimal(str(row.total or 0)).quantize(Decimal("0.01")), int(row.cnt or 0))
            for row in rows
        }
        total_expenses = sum((total for total, _ in by_bucket.values()), ZERO)
        segments = [
            ("cotidiana", "Cotidiana", "Até R$ 50"),
            ("pequena", "Pequena", "De R$ 50,01 a R$ 200"),
            ("media", "Média", "De R$ 200,01 a R$ 1.000"),
            ("alta", "Alta", "De R$ 1.000,01 a R$ 5.000"),
            ("premium", "Premium", "Acima de R$ 5.000"),
        ]
        items: list[dict[str, object]] = []
        for key, label, helper in segments:
            total, count = by_bucket.get(key, (ZERO, 0))
            share_ratio = (
                (total / total_expenses).quantize(Decimal("0.0001"))
                if total_expenses > ZERO
                else ZERO
            )
            average_amount = (total / Decimal(count)).quantize(Decimal("0.01")) if count else ZERO
            items.append(
                {
                    "key": key,
                    "label": label,
                    "helper": helper,
                    "total": total.quantize(Decimal("0.01")),
                    "count": count,
                    "share_ratio": share_ratio,
                    "average_amount": average_amount,
                }
            )
        return items

    def spending_breakdown(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> dict[str, object]:
        """Two expense views for the period: size buckets (P/M/G/GG) and
        fixed vs variable costs (fixed = recurring with a stable amount)."""
        # --- 1) Detect "fixed" descriptions over a trailing 6-month window. ----
        if date_to is not None:
            detect_from = _add_months(date(date_to.year, date_to.month, 1), -5)
            if date_from is not None and date_from < detect_from:
                detect_from = date_from
        else:
            detect_from = date_from
        detect_amounts: dict[str, list[Decimal]] = {}
        detect_months: dict[str, set[str]] = {}
        for t in self._transactions(workspace_id, detect_from, date_to):
            if t.direction != "debit":
                continue
            detect_amounts.setdefault(t.description, []).append(abs(t.amount))
            detect_months.setdefault(t.description, set()).add(t.transaction_date.strftime("%Y-%m"))
        fixed_descriptions: set[str] = set()
        monthly_amount: dict[str, Decimal] = {}
        for descr, amounts in detect_amounts.items():
            if len(detect_months[descr]) < _FIXED_MIN_MONTHS or len(amounts) < 2:
                continue
            vals = [float(a) for a in amounts]
            mean = sum(vals) / len(vals)
            if mean <= 0:
                continue
            variance = sum((v - mean) ** 2 for v in vals) / len(vals)
            if (variance ** 0.5) / mean <= _FIXED_MAX_CV:
                fixed_descriptions.add(descr)
                ordered = sorted(amounts)
                monthly_amount[descr] = ordered[len(ordered) // 2]

        # --- 2) Classify the period's expenses. --------------------------------
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
                *self._transaction_filters(workspace_id, date_from, date_to),
                Transaction.direction == "debit",
            )
        ).all()
        cats_by_id = {c.id: c for _, c in rows if c is not None}

        size_acc = {key: {"count": 0, "total": ZERO} for key, *_ in _SIZE_BUCKETS}
        fixed_total = ZERO
        fixed_count = 0
        variable_total = ZERO
        variable_count = 0
        total_expense = ZERO
        fixed_items_acc: dict[str, dict[str, object]] = {}
        for transaction, category in rows:
            amount = abs(transaction.amount)
            total_expense += amount
            for key, _label, _helper, low, high in _SIZE_BUCKETS:
                if amount > low and (high is None or amount <= high):
                    size_acc[key]["count"] += 1
                    size_acc[key]["total"] += amount
                    break
            if transaction.description in fixed_descriptions:
                fixed_total += amount
                fixed_count += 1
                display = (
                    cats_by_id.get(category.parent_category_id)
                    if category is not None and category.parent_category_id is not None
                    else category
                )
                item = fixed_items_acc.setdefault(
                    transaction.description,
                    {
                        "description": transaction.description,
                        "category_name": display.name if display is not None else None,
                        "total": ZERO,
                        "count": 0,
                    },
                )
                item["total"] = Decimal(item["total"]) + amount
                item["count"] = int(item["count"]) + 1
            else:
                variable_total += amount
                variable_count += 1

        size_buckets: list[dict[str, object]] = []
        for key, label, helper, _low, _high in _SIZE_BUCKETS:
            total = Decimal(size_acc[key]["total"]).quantize(Decimal("0.01"))
            count = int(size_acc[key]["count"])
            size_buckets.append(
                {
                    "key": key,
                    "label": label,
                    "helper": helper,
                    "count": count,
                    "total": total,
                    "average": (total / count).quantize(Decimal("0.01")) if count else ZERO,
                    "share_ratio": (
                        (total / total_expense).quantize(Decimal("0.0001"))
                        if total_expense > ZERO
                        else ZERO
                    ),
                }
            )

        fixed_items = sorted(
            fixed_items_acc.values(), key=lambda i: Decimal(i["total"]), reverse=True
        )[:15]
        for item in fixed_items:
            item_total = Decimal(item["total"]).quantize(Decimal("0.01"))
            item["total"] = item_total
            item["monthly_amount"] = monthly_amount.get(
                str(item["description"]), item_total
            ).quantize(Decimal("0.01"))

        return {
            "total_expense": total_expense.quantize(Decimal("0.01")),
            "size_buckets": size_buckets,
            "fixed": {
                "count": fixed_count,
                "total": fixed_total.quantize(Decimal("0.01")),
            },
            "variable": {
                "count": variable_count,
                "total": variable_total.quantize(Decimal("0.01")),
            },
            "fixed_items": fixed_items,
        }

    def category_trends(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
        limit: int,
    ) -> dict[str, object]:
        """Expense totals per top-level category over the selected period, for an
        evolution line chart (by category, not subcategory). Granularity adapts:
        monthly for spans up to 24 months, yearly for longer ranges so every
        category that has data shows up without an unreadable number of points."""
        end = date_to or self._latest_transaction_date(workspace_id)
        if end is None:
            return {"months": [], "series": [], "granularity": "month"}
        end_month = date(end.year, end.month, 1)
        if date_from is not None:
            start_month = date(date_from.year, date_from.month, 1)
        else:
            earliest = self.db.scalar(
                select(func.min(Transaction.transaction_date)).where(
                    Transaction.workspace_id == workspace_id
                )
            )
            start_month = (
                date(earliest.year, earliest.month, 1)
                if earliest is not None
                else _add_months(end_month, -5)
            )
        span = (end_month.year - start_month.year) * 12 + (end_month.month - start_month.month) + 1
        granularity = "month" if span <= 24 else "year"
        if granularity == "month" and span < 6:
            start_month = _add_months(end_month, -5)

        labels: list[str] = []
        if granularity == "month":
            cur = start_month
            while cur <= end_month:
                labels.append(cur.strftime("%Y-%m"))
                cur = _add_months(cur, 1)

            def bucket_of(d: date) -> str:
                return d.strftime("%Y-%m")
        else:
            for year in range(start_month.year, end_month.year + 1):
                labels.append(str(year))

            def bucket_of(d: date) -> str:
                return str(d.year)

        month_index = {m: i for i, m in enumerate(labels)}
        month_labels = labels

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
                *self._transaction_filters(workspace_id, start_month, end),
                Transaction.direction == "debit",
            )
        ).all()
        cats_by_id = {
            category.id: category
            for category in self.db.scalars(
                select(Category).where(Category.workspace_id == workspace_id)
            ).all()
        }

        acc: dict[str | None, dict[str, object]] = {}
        for transaction, category in rows:
            month = bucket_of(transaction.transaction_date)
            if month not in month_index:
                continue
            display = (
                cats_by_id.get(category.parent_category_id)
                if category is not None and category.parent_category_id is not None
                else category
            )
            cid = display.id if display is not None else None
            entry = acc.setdefault(
                cid,
                {
                    "category_id": cid,
                    "category_name": display.name if display is not None else "Sem categoria",
                    "color": display.color if display is not None else None,
                    "total": ZERO,
                    "points": [ZERO] * len(month_labels),
                },
            )
            amount = abs(transaction.amount)
            entry["total"] = Decimal(entry["total"]) + amount
            points = entry["points"]
            assert isinstance(points, list)
            points[month_index[month]] += amount

        ranked = sorted(acc.values(), key=lambda e: Decimal(e["total"]), reverse=True)[:limit]
        series = [
            {
                "category_id": e["category_id"],
                "category_name": e["category_name"],
                "color": e["color"],
                "total": Decimal(e["total"]).quantize(Decimal("0.01")),
                "points": [Decimal(p).quantize(Decimal("0.01")) for p in e["points"]],  # type: ignore[union-attr]
            }
            for e in ranked
        ]
        return {"months": month_labels, "series": series, "granularity": granularity}

    def merchant_ranking(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
        limit: int,
    ) -> list[dict[str, object]]:
        # SQL aggregation by merchant. The only Python rule was collapsing the
        # "MERCADO LIVRE" prefix into a single bucket — replicated here in SQL.
        merchant = case(
            (
                or_(
                    Transaction.description == "MERCADO LIVRE",
                    Transaction.description.like("MERCADO LIVRE %"),
                ),
                "MERCADO LIVRE",
            ),
            else_=Transaction.description,
        )
        rows = self.db.execute(
            select(
                merchant.label("description"),
                func.sum(func.abs(Transaction.amount)).label("amount"),
                func.count().label("count"),
            )
            .where(
                *self._transaction_filters(
                    workspace_id=workspace_id,
                    date_from=date_from,
                    date_to=date_to,
                ),
                Transaction.direction == "debit",
            )
            .group_by(merchant)
        ).all()
        ranked = sorted(
            (
                {
                    "description": row.description,
                    "amount": Decimal(str(row.amount or 0)).quantize(Decimal("0.01")),
                    "count": int(row.count or 0),
                }
                for row in rows
            ),
            key=lambda item: (
                Decimal(item["amount"]),
                int(item["count"]),
                str(item["description"]),
            ),
            reverse=True,
        )
        return ranked[:limit]

    def recurring_expenses(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
        min_months: int,
        limit: int,
    ) -> list[dict[str, object]]:
        return self._recurring_transactions(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
            min_months=min_months,
            limit=limit,
            direction="debit",
        )

    def recurring_incomes(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
        min_months: int,
        limit: int,
    ) -> list[dict[str, object]]:
        return self._recurring_transactions(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
            min_months=min_months,
            limit=limit,
            direction="credit",
        )

    def _recurring_transactions(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
        min_months: int,
        limit: int,
        direction: str,
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
                Transaction.direction == direction,
            )
            .order_by(Transaction.description, Transaction.transaction_date, Transaction.id)
        ).all()
        categories_by_id = {
            category.id: category
            for _, category in rows
            if category is not None
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
        # Aggregate per weekday in SQL (≤7 rows). The weekday function is
        # dialect-specific; both return Sunday=0..Saturday=6, which we remap to
        # Python's Monday=0..Sunday=6 used by the buckets.
        if self.db.bind.dialect.name == "sqlite":
            dow = func.strftime("%w", Transaction.transaction_date)
        else:
            dow = func.extract("dow", Transaction.transaction_date)
        rows = self.db.execute(
            select(
                dow.label("dow"),
                func.sum(func.abs(Transaction.amount)).label("total"),
                func.count().label("cnt"),
            )
            .where(
                *self._transaction_filters(
                    workspace_id=workspace_id,
                    date_from=date_from,
                    date_to=date_to,
                ),
                Transaction.direction == "debit",
            )
            .group_by(dow)
        ).all()
        for row in rows:
            python_weekday = (int(float(row.dow)) + 6) % 7
            bucket = buckets[python_weekday]
            bucket["amount"] = Decimal(str(row.total or 0)).quantize(Decimal("0.01"))
            bucket["count"] = int(row.cnt or 0)

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
        # Only payment rows are needed (a small subset), not the whole period.
        payments = self.db.scalars(
            select(Transaction).where(
                *self._transaction_filters(
                    workspace_id=workspace_id, date_from=date_from, date_to=date_to
                ),
                Transaction.direction == "payment",
            )
        ).all()
        bank_payments = [t for t in payments if t.source_type == "bank_statement"]
        card_payments = [t for t in payments if t.source_type == "credit_card_statement"]
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

    def projection_feed(
        self,
        workspace_id: str,
        horizon_days: int,
        lookback_months: int = 3,
    ) -> dict[str, object]:
        today = date.today()
        horizon_date = date.fromordinal(today.toordinal() + horizon_days)
        # Use configurable lookback (3 or 6 months) — restricting to a shorter window
        # avoids one-off transactions from older periods distorting the projection.
        effective_lookback = max(3, min(lookback_months, 6))
        lookback = _add_months(today, -effective_lookback)

        current_balance = self._current_account_balance(workspace_id=workspace_id, date_to=today)
        known_events = self._projection_known_events(
            workspace_id=workspace_id, date_from=today, date_to=horizon_date
        )
        recurring_expenses = self._recurring_transactions(
            workspace_id=workspace_id,
            date_from=lookback,
            date_to=today,
            min_months=min(effective_lookback, 3),
            limit=50,
            direction="debit",
        )
        recurring_incomes = self._recurring_transactions(
            workspace_id=workspace_id,
            date_from=lookback,
            date_to=today,
            min_months=min(effective_lookback, 3),
            limit=20,
            direction="credit",
        )
        credit_card_installments = self._projection_credit_card_statements(
            workspace_id=workspace_id, date_from=today, date_to=horizon_date
        )
        variable_categories = self._projection_variable_categories(
            workspace_id=workspace_id, today=today
        )
        recurring_items: list[dict[str, object]] = [
            {
                "description": item["description"],
                "amount": item["last_amount"],
                "average_amount": item["average_amount"],
                "type": "expense",
                "last_date": item["last_transaction_date"].isoformat(),
                "month_count": item["month_count"],
                "transaction_count": item["transaction_count"],
                "category_id": item["category_id"],
                "frequency": "monthly",
            }
            for item in recurring_expenses
        ] + [
            {
                "description": item["description"],
                "amount": item["last_amount"],
                "average_amount": item["average_amount"],
                "type": "income",
                "last_date": item["last_transaction_date"].isoformat(),
                "month_count": item["month_count"],
                "transaction_count": item["transaction_count"],
                "category_id": item["category_id"],
                "frequency": "monthly",
            }
            for item in recurring_incomes
        ]
        return {
            "workspace_id": workspace_id,
            "current_balance": current_balance.balance_amount if current_balance else None,
            "current_balance_date": current_balance.balance_date if current_balance else None,
            "current_balance_account": current_balance.account_name if current_balance else None,
            "known_events": known_events,
            "recurring_items": recurring_items,
            "credit_card_installments": credit_card_installments,
            "variable_categories": variable_categories,
        }

    def projection(self, workspace_id: str, horizon_days: int) -> dict[str, object]:
        """Single source of truth for the balance projection.

        Starts from the real account balance and rolls forward the recurring net
        (income - expenses - variable), dated credit-card installments and
        planned calendar events. Three scenarios differ by variable spend
        volatility (from each category's history) and a small income haircut on
        the worst case. Honours the protected-reserve preference for risk.
        """
        horizon_days = max(30, min(horizon_days, 366))
        feed = self.projection_feed(workspace_id, horizon_days, lookback_months=6)
        prefs = self._preferences(workspace_id)
        protected_reserve = prefs.protected_reserve if prefs else ZERO

        start = feed["current_balance"] or ZERO
        if not isinstance(start, Decimal):
            start = Decimal(str(start))

        recurring = feed["recurring_items"]
        rec_income = sum(
            (Decimal(str(r["average_amount"])) for r in recurring if r["type"] == "income"),
            ZERO,
        )
        rec_expense = sum(
            (Decimal(str(r["average_amount"])) for r in recurring if r["type"] == "expense"),
            ZERO,
        )

        # Variable spend: exclude the uncategorized bucket; derive best/worst from
        # each category's historical volatility (1 std dev), fallback to +-30%.
        var_avg = var_best = var_worst = ZERO
        uncategorized = ZERO
        for v in feed["variable_categories"]:
            avg = Decimal(str(v["monthly_average"]))
            if not v["category_id"]:
                uncategorized += avg
                continue
            hist = [Decimal(str(x)) for x in v["historical_monthly_amounts"]]
            if len(hist) >= 2:
                mean = sum(hist, ZERO) / Decimal(len(hist))
                variance = sum(((x - mean) ** 2 for x in hist), ZERO) / Decimal(len(hist))
                std = variance.sqrt()
                best_c = max(min(hist), (avg - std))
                worst_c = avg + std
            else:
                best_c = (avg * Decimal("0.70")).quantize(Decimal("0.01"))
                worst_c = (avg * Decimal("1.30")).quantize(Decimal("0.01"))
            var_avg += avg
            var_best += max(best_c, ZERO)
            var_worst += worst_c

        net_best = rec_income - rec_expense - var_best
        net_prob = rec_income - rec_expense - var_avg
        net_worst = (rec_income * Decimal("0.95")) - rec_expense - var_worst

        today = date.today()
        n_months = max(1, round(horizon_days / 30))
        horizon_end = _add_months(today, n_months)

        recurring_descriptions = {
            normalize_transaction_description(str(r["description"])) for r in recurring
        }
        seasonal = self._seasonal_items(
            workspace_id, today, horizon_end, recurring_descriptions
        )

        # Unified dated one-off events: card installments, planned calendar
        # events and detected seasonal items (13o/ferias/PLR, IPVA/IPTU/...).
        oneoffs: list[dict[str, object]] = []
        for inst in feed["credit_card_installments"]:
            oneoffs.append(
                {
                    "date": inst["due_date"], "title": "Parcela de cartão",
                    "kind": "Parcela de cartão", "amount": Decimal(str(inst["amount"])),
                    "income": False, "monthly": False,
                }
            )
        for e in feed["known_events"]:
            is_income = e["type"] == "income"
            oneoffs.append(
                {
                    "date": e["date"], "title": e["description"],
                    "kind": "Receita prevista" if is_income else "Despesa prevista",
                    "amount": Decimal(str(e["amount"])), "income": is_income, "monthly": False,
                }
            )
        for s in seasonal:
            is_income = s["type"] == "income"
            oneoffs.append(
                {
                    "date": s["date"], "title": s["description"],
                    "kind": "Recebimento anual" if is_income else "Despesa anual",
                    "amount": Decimal(str(s["amount"])), "income": is_income, "monthly": False,
                }
            )

        def dated_delta(upto: date) -> Decimal:
            total = ZERO
            for o in oneoffs:
                if o["date"] and date.fromisoformat(str(o["date"])) <= upto:
                    total += o["amount"] if o["income"] else -o["amount"]
            return total

        points: list[dict[str, object]] = []
        for i in range(n_months + 1):
            point_date = _add_months(today, i)
            delta = dated_delta(point_date)
            months = Decimal(i)
            points.append(
                {
                    "month": point_date.strftime("%Y-%m"),
                    "probable": (start + net_prob * months + delta).quantize(Decimal("0.01")),
                    "best": (start + net_best * months + delta).quantize(Decimal("0.01")),
                    "worst": (start + net_worst * months + delta).quantize(Decimal("0.01")),
                }
            )

        prob_values = [p["probable"] for p in points]
        worst_values = [p["worst"] for p in points]
        end_balance = prob_values[-1]
        min_balance = min(prob_values)
        worst_min = min(worst_values)
        variation = end_balance - start
        variation_pct = (
            (variation / abs(start) * Decimal("100")).quantize(Decimal("0.1"))
            if start != ZERO
            else ZERO
        )

        if worst_min < ZERO:
            risk_level = "risk"
            risk_reason = f"No pior cenário o saldo fica negativo (mín. {worst_min})."
        elif min_balance < protected_reserve or worst_min < protected_reserve:
            risk_level = "attention"
            risk_reason = "O saldo fica abaixo da reserva protegida em algum momento."
        else:
            risk_level = "healthy"
            risk_reason = "O saldo se mantém confortável no período."

        commitments = sorted(
            (o for o in oneoffs if o["date"]), key=lambda c: str(c["date"])
        )
        for r in sorted(
            recurring, key=lambda r: Decimal(str(r["average_amount"])), reverse=True
        )[:5]:
            is_income = r["type"] == "income"
            commitments.append(
                {
                    "date": "", "title": r["description"],
                    "kind": "Receita mensal" if is_income else "Despesa mensal",
                    "amount": Decimal(str(r["average_amount"])), "income": is_income,
                    "monthly": True,
                }
            )

        var_note = "(cenários por volatilidade histórica)"
        assumptions = [
            f"Saldo inicial real: {start} ({feed.get('current_balance_account') or 'conta'}).",
            f"Receitas recorrentes ≈ {rec_income.quantize(Decimal('0.01'))}/mês.",
            f"Despesas recorrentes ≈ {rec_expense.quantize(Decimal('0.01'))}/mês.",
            f"Despesas variáveis ≈ {var_avg.quantize(Decimal('0.01'))}/mês {var_note}.",
            f"Fluxo recorrente líquido ≈ {net_prob.quantize(Decimal('0.01'))}/mês.",
        ]
        if seasonal:
            assumptions.append(
                f"{len(seasonal)} evento(s) anual(is) detectado(s) (13º/IPVA/etc.) "
                "incluídos no período."
            )
        if uncategorized > ZERO:
            assumptions.append(
                f"Lançamentos sem categoria ({uncategorized.quantize(Decimal('0.01'))}/mês) "
                "ficam fora — categorize-os para refinar."
            )

        return {
            "workspace_id": workspace_id,
            "horizon_days": horizon_days,
            "start_balance": start.quantize(Decimal("0.01")),
            "recurring_income": rec_income.quantize(Decimal("0.01")),
            "recurring_expense": rec_expense.quantize(Decimal("0.01")),
            "variable_average": var_avg.quantize(Decimal("0.01")),
            "monthly_net": net_prob.quantize(Decimal("0.01")),
            "points": points,
            "end_best": points[-1]["best"],
            "end_probable": end_balance,
            "end_worst": points[-1]["worst"],
            "min_balance": min_balance,
            "variation": variation.quantize(Decimal("0.01")),
            "variation_pct": variation_pct,
            "risk_level": risk_level,
            "risk_reason": risk_reason,
            "commitments": commitments[:50],
            "assumptions": assumptions,
        }

    def _seasonal_items(
        self,
        workspace_id: str,
        today: date,
        horizon_end: date,
        exclude_descriptions: set[str],
    ) -> list[dict[str, object]]:
        """Detect annual/seasonal items from history (13o, ferias, PLR, IPVA,
        IPTU, licenciamento, ...) and schedule their next occurrence within the
        horizon. An item is considered annual when the same normalized
        description recurs in the same calendar month across >= 2 different
        years. Monthly-recurring descriptions are excluded to avoid double
        counting."""
        lookback = _add_months(today, -24)
        # Narrow the pull to the rows this detector actually uses (non-card
        # debits/credits) instead of every transaction in the 24-month window.
        txns = self.db.scalars(
            select(Transaction).where(
                *self._transaction_filters(workspace_id, lookback, today),
                Transaction.direction.in_(("debit", "credit")),
                or_(
                    Transaction.source_type != "credit_card_statement",
                    Transaction.source_type.is_(None),
                ),
            )
        ).all()
        groups: dict[tuple[str, str], list[Transaction]] = defaultdict(list)
        for t in txns:
            key = normalize_transaction_description(t.description)
            if key in exclude_descriptions:
                continue
            groups[(key, t.direction)].append(t)

        items: list[dict[str, object]] = []
        for (_key, direction), txs in groups.items():
            by_month: dict[int, list[Transaction]] = defaultdict(list)
            for t in txs:
                by_month[t.transaction_date.month].append(t)
            # Pick the month whose occurrences span the most distinct years (>= 2).
            best_month: int | None = None
            best_years = 1
            best_list: list[Transaction] = []
            for month, lst in by_month.items():
                years = {t.transaction_date.year for t in lst}
                if len(years) >= 2 and len(years) > best_years - 1 and len(lst) >= len(best_list):
                    best_years = len(years)
                    best_month = month
                    best_list = lst
            if best_month is None:
                continue
            amounts = sorted(abs(t.amount) for t in best_list)
            amount = amounts[len(amounts) // 2]
            if amount < Decimal("300"):
                continue
            day = Counter(t.transaction_date.day for t in best_list).most_common(1)[0][0]
            for year in (today.year, today.year + 1):
                occ = _day_in_month(year, best_month, day)
                if today < occ <= horizon_end:
                    items.append(
                        {
                            "date": occ.isoformat(),
                            "description": best_list[-1].description,
                            "amount": amount,
                            "type": "income" if direction == "credit" else "expense",
                        }
                    )
                    break
        return items

    def _projection_known_events(
        self,
        workspace_id: str,
        date_from: date,
        date_to: date,
    ) -> list[dict[str, object]]:
        events = self.db.scalars(
            select(FinancialCalendarEvent)
            .where(
                FinancialCalendarEvent.workspace_id == workspace_id,
                FinancialCalendarEvent.status == "planned",
                FinancialCalendarEvent.amount.is_not(None),
                FinancialCalendarEvent.due_date >= date_from,
                FinancialCalendarEvent.due_date <= date_to,
            )
            .order_by(FinancialCalendarEvent.due_date, FinancialCalendarEvent.title)
        ).all()
        return [
            {
                "amount": event.amount,
                "date": event.due_date.isoformat(),
                "description": event.title,
                "source": "calendar",
                "type": "income" if event.event_type == "income" else "expense",
            }
            for event in events
            if event.amount is not None and event.amount > ZERO
        ]

    def _projection_credit_card_statements(
        self,
        workspace_id: str,
        date_from: date,
        date_to: date,
    ) -> list[dict[str, object]]:
        statements = self.db.scalars(
            select(CreditCardStatement)
            .where(
                CreditCardStatement.workspace_id == workspace_id,
                CreditCardStatement.status.in_(["open", "closed"]),
                CreditCardStatement.due_date >= date_from,
                CreditCardStatement.due_date <= date_to,
                CreditCardStatement.total_amount.is_not(None),
            )
            .order_by(CreditCardStatement.due_date)
        ).all()
        return [
            {
                "amount": statement.total_amount,
                "description": f"Fatura {statement.due_date.strftime('%m/%Y')}",
                "due_date": statement.due_date.isoformat(),
            }
            for statement in statements
            if statement.total_amount is not None and statement.total_amount > ZERO
        ]

    def _projection_variable_categories(
        self,
        workspace_id: str,
        today: date,
    ) -> list[dict[str, object]]:
        month_start = date(today.year, today.month, 1)
        history_from = _add_months(month_start, -6)
        current_month_str = month_start.strftime("%Y-%m")

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
                Transaction.workspace_id == workspace_id,
                Transaction.direction == "debit",
                Transaction.transaction_date >= history_from,
                Transaction.transaction_date <= today,
            )
            .order_by(Transaction.transaction_date, Transaction.id)
        ).all()

        categories_by_id = {
            cat.id: cat
            for _, cat in rows
            if cat is not None
        }

        grouped: dict[tuple[str | None, str], dict[str, object]] = {}
        for transaction, category in rows:
            display_category = (
                categories_by_id.get(category.parent_category_id)
                if category is not None and category.parent_category_id is not None
                else category
            )
            cat_id = display_category.id if display_category is not None else None
            cat_name = display_category.name if display_category is not None else "Sem categoria"
            key = (cat_id, cat_name)
            item = grouped.setdefault(
                key,
                {
                    "category_id": cat_id,
                    "category_name": cat_name,
                    "monthly_amounts": {},
                    "current_month_spent": ZERO,
                },
            )
            month = transaction.transaction_date.strftime("%Y-%m")
            amount = abs(transaction.amount)
            if month == current_month_str:
                item["current_month_spent"] = Decimal(item["current_month_spent"]) + amount
            else:
                monthly: dict[str, Decimal] = item["monthly_amounts"]  # type: ignore[assignment]
                monthly[month] = monthly.get(month, ZERO) + amount

        result: list[dict[str, object]] = []
        for item in grouped.values():
            monthly: dict[str, Decimal] = item["monthly_amounts"]  # type: ignore[assignment]
            if len(monthly) < 2:
                continue
            amounts_list = sorted(monthly.values())
            monthly_average = (sum(amounts_list, ZERO) / Decimal(len(amounts_list))).quantize(
                Decimal("0.01")
            )
            result.append(
                {
                    "category_id": item["category_id"],
                    "category_name": item["category_name"],
                    "current_month_spent": Decimal(item["current_month_spent"]).quantize(
                        Decimal("0.01")
                    ),
                    "historical_monthly_amounts": [
                        v.quantize(Decimal("0.01")) for v in amounts_list
                    ],
                    "monthly_average": monthly_average,
                }
            )

        return sorted(
            result,
            key=lambda item: Decimal(item["monthly_average"]),
            reverse=True,
        )

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

    def _cashflow_transactions(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> list[Transaction]:
        if date_from is None and date_to is None:
            return self._transactions(
                workspace_id=workspace_id,
                date_from=None,
                date_to=None,
            )

        installment_from = _add_months(date_from, -99) if date_from is not None else None
        installment_clause = and_(
            Transaction.source_type == "credit_card_statement",
            Transaction.direction == "debit",
            Transaction.installment_current.is_not(None),
            Transaction.installment_total.is_not(None),
        )
        regular_filters = self._transaction_filters(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        installment_filters = self._transaction_filters(
            workspace_id=workspace_id,
            date_from=installment_from,
            date_to=date_to,
        )
        source_file_month_filters = _source_file_month_filters(date_from, date_to)
        cashflow_clauses = [
            and_(*regular_filters),
            and_(installment_clause, *installment_filters),
        ]
        if source_file_month_filters:
            cashflow_clauses.append(
                and_(
                    Transaction.source_type == "credit_card_statement",
                    Transaction.direction == "debit",
                    SourceFile.source_kind == "credit_card_csv",
                    or_(*source_file_month_filters),
                )
            )
        return self.db.scalars(
            select(Transaction)
            .join(SourceFile, SourceFile.id == Transaction.source_file_id)
            .where(or_(*cashflow_clauses))
            .order_by(Transaction.transaction_date, Transaction.id)
        ).all()

    def _source_file_statement_due_dates(self, transactions: list[Transaction]) -> dict[str, date]:
        source_file_ids = {
            transaction.source_file_id
            for transaction in transactions
            if transaction.source_type == "credit_card_statement"
            and transaction.direction == "debit"
        }
        if not source_file_ids:
            return {}

        rows = self.db.execute(
            select(SourceFile.id, SourceFile.original_filename, SourceFile.source_kind).where(
                SourceFile.id.in_(source_file_ids)
            )
        ).all()
        due_dates: dict[str, date] = {}
        for source_file_id, original_filename, source_kind in rows:
            if source_kind != "credit_card_csv":
                continue
            due_date = _statement_due_date_from_filename(original_filename)
            if due_date is not None:
                due_dates[str(source_file_id)] = due_date
        return due_dates

    def _cashflow_date(
        self,
        transaction: Transaction,
        statement_due_date: date | None = None,
    ) -> date:
        if transaction.source_type == "credit_card_statement" and transaction.direction == "debit":
            if statement_due_date is not None:
                return statement_due_date
            if not (transaction.installment_current and transaction.installment_total):
                return transaction.transaction_date
            first_invoice_month = get_first_invoice_month(
                transaction.transaction_date,
                settings.default_credit_card_closing_day,
            )
            invoice_month = _add_months(first_invoice_month, transaction.installment_current - 1)
            return _day_in_month(
                invoice_month.year,
                invoice_month.month,
                settings.default_credit_card_due_day,
            )
        return transaction.transaction_date

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

    def _debit_window_stats(
        self, workspace_id: str, date_from: date | None, date_to: date | None
    ) -> tuple[Decimal, date | None, int]:
        """SQL totals for debits in a window: (sum of abs amount, earliest date,
        count) — used by the burn-rate helpers instead of pulling every row."""
        row = self.db.execute(
            select(
                func.sum(func.abs(Transaction.amount)),
                func.min(Transaction.transaction_date),
                func.count(),
            ).where(
                *self._transaction_filters(
                    workspace_id=workspace_id, date_from=date_from, date_to=date_to
                ),
                Transaction.direction == "debit",
            )
        ).one()
        total = Decimal(str(row[0])).quantize(Decimal("0.01")) if row[0] is not None else ZERO
        first_date = row[1]
        if isinstance(first_date, str):
            first_date = date.fromisoformat(first_date[:10])
        return total, first_date, int(row[2] or 0)

    def _burn_rate(self, workspace_id: str, date_to: date | None) -> tuple[Decimal, int]:
        anchor = date_to or self._latest_transaction_date(workspace_id)
        if anchor is None:
            return ZERO, 0
        window_start = _add_months(date(anchor.year, anchor.month, 1), -11)
        expenses, first_date, count = self._debit_window_stats(workspace_id, window_start, anchor)
        if not count or first_date is None:
            return ZERO, 0
        first_month = date(first_date.year, first_date.month, 1)
        months = min(12, _inclusive_months(first_month, anchor))
        burn_rate = (expenses / Decimal(months)).quantize(Decimal("0.01")) if months else ZERO
        return burn_rate, months

    def _preferences(self, workspace_id: str) -> WorkspacePreferences | None:
        return self.db.get(WorkspacePreferences, workspace_id)

    def _burn_rate_window(
        self, workspace_id: str, date_to: date | None, months: int
    ) -> Decimal:
        """Monthly-equivalent burn rate over the trailing `months` months."""
        anchor = date_to or self._latest_transaction_date(workspace_id)
        if anchor is None:
            return ZERO
        window_start = anchor - timedelta(days=months * 30 - 1)
        expenses, first_date, count = self._debit_window_stats(workspace_id, window_start, anchor)
        if not count or first_date is None:
            return ZERO
        first = max(first_date, window_start)
        window_days = max((anchor - first).days + 1, 1)
        return (expenses / Decimal(window_days) * Decimal(30)).quantize(Decimal("0.01"))

    def _burn_rate_90_days(self, workspace_id: str, date_to: date | None) -> tuple[Decimal, int]:
        anchor = date_to or self._latest_transaction_date(workspace_id)
        if anchor is None:
            return ZERO, 0
        window_start = anchor - timedelta(days=89)
        expenses, first_date, count = self._debit_window_stats(workspace_id, window_start, anchor)
        if not count or first_date is None:
            return ZERO, 0
        first_debit_date = max(first_date, window_start)
        window_days = max((anchor - first_debit_date).days + 1, 1)
        monthly_equivalent = (expenses / Decimal(window_days) * Decimal(30)).quantize(
            Decimal("0.01")
        )
        return monthly_equivalent, window_days

    def _safe_spend(
        self,
        workspace_id: str,
        date_to: date | None,
        current_balance: Decimal | None,
        reserve_minimum: Decimal,
    ) -> tuple[Decimal | None, Decimal | None]:
        if current_balance is None:
            return None, None
        anchor = date_to or self._latest_transaction_date(workspace_id) or date.today()
        horizon_start = anchor + timedelta(days=1)
        horizon_end = anchor + timedelta(days=30)
        transactions = self._cashflow_transactions(
            workspace_id=workspace_id,
            date_from=horizon_start,
            date_to=horizon_end,
        )
        source_file_due_dates = self._source_file_statement_due_dates(transactions)
        income = ZERO
        outflow = ZERO
        for transaction in transactions:
            cashflow_date = self._cashflow_date(
                transaction,
                source_file_due_dates.get(transaction.source_file_id),
            )
            if not _date_in_range(cashflow_date, horizon_start, horizon_end):
                continue
            if transaction.direction == "credit":
                income += abs(transaction.amount)
            elif transaction.direction in {"debit", "payment"}:
                outflow += abs(transaction.amount)
        safe_spend = (current_balance + income - outflow - reserve_minimum).quantize(
            Decimal("0.01")
        )
        return safe_spend, reserve_minimum.quantize(Decimal("0.01"))

    def _financial_health_score(
        self,
        commitment_rate: Decimal | None,
        current_balance: Decimal | None,
        income: Decimal,
        savings_rate: Decimal | None,
        safe_spend: Decimal | None,
        burn_rate: Decimal,
    ) -> int | None:
        if current_balance is None or burn_rate <= ZERO:
            return None

        score = Decimal("0")
        runway_months = current_balance / burn_rate if burn_rate > ZERO else ZERO

        score += min(max(runway_months / Decimal("6"), ZERO), Decimal("1")) * Decimal("30")

        if savings_rate is not None:
            score += min(max(savings_rate / Decimal("0.20"), ZERO), Decimal("1")) * Decimal("20")

        if commitment_rate is not None:
            commitment_component = Decimal("1") - min(
                max((commitment_rate - Decimal("0.50")) / Decimal("0.50"), ZERO),
                Decimal("1"),
            )
            score += commitment_component * Decimal("20")

        if safe_spend is not None:
            safe_spend_component = Decimal("1") if safe_spend >= ZERO else Decimal("0")
            score += safe_spend_component * Decimal("20")

        score += (Decimal("1") if income > ZERO else Decimal("0")) * Decimal("10")
        return int(min(max(score, ZERO), Decimal("100")).quantize(Decimal("1")))

    def _latest_transaction_date(self, workspace_id: str) -> date | None:
        return self.db.scalar(
            select(func.max(Transaction.transaction_date)).where(
                Transaction.workspace_id == workspace_id,
                Transaction.natural_dedupe_key.is_not(None),
            )
        )

    def _current_account_balance(
        self,
        workspace_id: str,
        date_to: date | None,
    ) -> AccountBalance | None:
        filters = [AccountBalance.workspace_id == workspace_id]
        if date_to is not None:
            filters.append(AccountBalance.balance_date <= date_to)
        return self.db.scalars(
            select(AccountBalance)
            .where(*filters)
            .order_by(
                desc(AccountBalance.balance_date),
                desc(AccountBalance.created_at),
                AccountBalance.id,
            )
            .limit(1)
        ).first()

    def _opening_account_balance(
        self,
        workspace_id: str,
        date_from: date | None,
    ) -> Decimal:
        if date_from is None:
            return ZERO
        balance = self._current_account_balance(
            workspace_id=workspace_id,
            date_to=date_from - timedelta(days=1),
        )
        return balance.balance_amount if balance is not None else ZERO

    def _account_balances_by_date(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> dict[date, Decimal]:
        filters = [AccountBalance.workspace_id == workspace_id]
        if date_from is not None:
            filters.append(AccountBalance.balance_date >= date_from)
        if date_to is not None:
            filters.append(AccountBalance.balance_date <= date_to)
        rows = self.db.scalars(
            select(AccountBalance)
            .where(*filters)
            .order_by(
                AccountBalance.balance_date,
                desc(AccountBalance.created_at),
                AccountBalance.id,
            )
        ).all()
        balances: dict[date, Decimal] = {}
        for row in rows:
            balances[row.balance_date] = row.balance_amount
        return balances

    def _account_balances_by_month(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> dict[str, Decimal]:
        by_date = self._account_balances_by_date(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        balances: dict[str, Decimal] = {}
        for balance_date in sorted(by_date):
            balances[balance_date.strftime("%Y-%m")] = by_date[balance_date]
        return balances


def _statement_due_date_from_filename(filename: str) -> date | None:
    match = re.search(r"(?<!\d)(20\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])(?!\d)", filename)
    if match is None:
        return None
    year, month, day = (int(part) for part in match.groups())
    try:
        return date(year, month, day)
    except ValueError:
        return None




def _source_file_month_filters(date_from: date | None, date_to: date | None) -> list[object]:
    if date_from is None or date_to is None or date_from > date_to:
        return []
    month_count = _inclusive_months(date(date_from.year, date_from.month, 1), date_to)
    if month_count > 24:
        return []
    return [
        SourceFile.original_filename.ilike(f"%{_add_months(date_from, offset):%Y%m}%")
        for offset in range(month_count)
    ]


def _inclusive_months(date_from: date, date_to: date) -> int:
    if date_to < date_from:
        return 0
    return (date_to.year - date_from.year) * 12 + date_to.month - date_from.month + 1


def _add_months(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 + months
    year = month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def _day_in_month(year: int, month: int, day: int) -> date:
    return date(year, month, min(day, monthrange(year, month)[1]))


def _date_in_range(value: date, date_from: date | None, date_to: date | None) -> bool:
    if date_from is not None and value < date_from:
        return False
    if date_to is not None and value > date_to:
        return False
    return True


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
