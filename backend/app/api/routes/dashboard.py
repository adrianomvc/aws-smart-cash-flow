from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.session import get_db
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
DbDependency = Depends(get_db)


class DashboardSummaryResponse(BaseModel):
    workspace_id: str
    date_from: date | None
    date_to: date | None
    income: Decimal
    expenses: Decimal
    payments: Decimal
    balance: Decimal
    savings_rate: Decimal | None
    commitment_rate: Decimal | None
    burn_rate: Decimal
    burn_rate_months: int
    burn_rate_basis: str
    burn_rate_90_days: Decimal
    burn_rate_90_days_window: int
    burn_rate_90_days_basis: str
    safe_spend: Decimal | None
    safe_spend_reserve_minimum: Decimal | None
    safe_spend_basis: str
    financial_health_score: int | None
    financial_health_basis: str
    transaction_count: int
    current_balance: Decimal | None
    current_balance_date: date | None
    current_balance_account: str | None
    commitment_limit: Decimal
    commitment_over_limit: bool
    savings_target: Decimal
    savings_on_target: bool
    protected_reserve: Decimal
    burn_rate_window_months: int


class MonthlyCashflowItem(BaseModel):
    month: str
    income: Decimal
    expenses: Decimal
    payments: Decimal
    balance: Decimal
    opening_balance: Decimal
    closing_balance: Decimal
    transaction_count: int


class MonthlyCashflowResponse(BaseModel):
    workspace_id: str
    items: list[MonthlyCashflowItem]


class DailyCashflowItem(BaseModel):
    date: date
    income: Decimal
    expenses: Decimal
    payments: Decimal
    balance: Decimal
    opening_balance: Decimal
    closing_balance: Decimal
    transaction_count: int


class DailyCashflowResponse(BaseModel):
    workspace_id: str
    items: list[DailyCashflowItem]


class CategoryRankingItem(BaseModel):
    category_id: str | None
    category_name: str
    color: str | None = None
    icon: str | None = None
    amount: Decimal
    count: int
    share_ratio: Decimal | None
    average_amount: Decimal
    last_transaction_date: date | None = None


class CategoryRankingResponse(BaseModel):
    workspace_id: str
    items: list[CategoryRankingItem]


class SubcategoryRankingItem(BaseModel):
    category_id: str | None
    subcategory_name: str
    color: str | None = None
    amount: Decimal
    count: int
    share_ratio: Decimal | None
    average_amount: Decimal


class SubcategoryRankingResponse(BaseModel):
    workspace_id: str
    items: list[SubcategoryRankingItem]


class ExpenseSizeProfileItem(BaseModel):
    key: str
    label: str
    helper: str
    total: Decimal
    count: int
    share_ratio: Decimal
    average_amount: Decimal


class ExpenseSizeProfileResponse(BaseModel):
    workspace_id: str
    items: list[ExpenseSizeProfileItem]


class SizeBucketItem(BaseModel):
    key: str
    label: str
    helper: str
    count: int
    total: Decimal
    average: Decimal
    share_ratio: Decimal


class CostTypeStat(BaseModel):
    count: int
    total: Decimal


class FixedCostItem(BaseModel):
    description: str
    category_name: str | None
    total: Decimal
    count: int
    monthly_amount: Decimal


class SpendingBreakdownResponse(BaseModel):
    workspace_id: str
    total_expense: Decimal
    size_buckets: list[SizeBucketItem]
    fixed: CostTypeStat
    variable: CostTypeStat
    fixed_items: list[FixedCostItem]


class CategoryTrendSeries(BaseModel):
    category_id: str | None
    category_name: str
    color: str | None = None
    total: Decimal
    points: list[Decimal]


class CategoryTrendsResponse(BaseModel):
    workspace_id: str
    months: list[str]
    series: list[CategoryTrendSeries]


class MerchantRankingItem(BaseModel):
    description: str
    amount: Decimal
    count: int


class MerchantRankingResponse(BaseModel):
    workspace_id: str
    items: list[MerchantRankingItem]


class RecurringExpenseItem(BaseModel):
    description: str
    category_id: str | None
    category_name: str | None
    average_amount: Decimal
    last_amount: Decimal
    transaction_count: int
    month_count: int
    last_transaction_date: date
    change_ratio: Decimal | None
    status: str


class RecurringExpensesResponse(BaseModel):
    workspace_id: str
    items: list[RecurringExpenseItem]


class RecurringIncomesResponse(BaseModel):
    workspace_id: str
    items: list[RecurringExpenseItem]


class CategoryGrowthAlertItem(BaseModel):
    category_id: str
    category_name: str
    current_amount: Decimal
    previous_amount: Decimal
    change_amount: Decimal
    change_ratio: Decimal
    current_count: int
    previous_count: int
    previous_date_from: date
    previous_date_to: date


class CategoryGrowthAlertsResponse(BaseModel):
    workspace_id: str
    items: list[CategoryGrowthAlertItem]


class WeekdaySpendingItem(BaseModel):
    weekday: int
    weekday_name: str
    amount: Decimal
    count: int
    average_amount: Decimal
    share_ratio: Decimal | None


class WeekdaySpendingResponse(BaseModel):
    workspace_id: str
    items: list[WeekdaySpendingItem]


class DataQualityResponse(BaseModel):
    workspace_id: str
    transaction_count: int
    categorized_count: int
    uncategorized_count: int
    categorized_ratio: Decimal | None
    imports_with_errors: int
    duplicate_imports: int


class CreditCardPaymentMatchItem(BaseModel):
    bank_transaction_id: str
    card_transaction_id: str
    amount: Decimal
    bank_date: date
    card_date: date
    date_delta_days: int
    bank_description: str
    card_description: str


class CreditCardPaymentMatchesResponse(BaseModel):
    workspace_id: str
    items: list[CreditCardPaymentMatchItem]


class CreditCardInstallmentItem(BaseModel):
    description: str
    amount: Decimal
    installment_current: int
    installment_total: int
    remaining_installments: int
    future_amount: Decimal
    first_invoice_month: date
    last_transaction_date: date
    transaction_count: int


class CreditCardInstallmentsResponse(BaseModel):
    workspace_id: str
    active_count: int
    closing_day: int
    due_day: int
    total_future_amount: Decimal
    items: list[CreditCardInstallmentItem]


class ProjectionFeedKnownEventItem(BaseModel):
    amount: Decimal
    date: date
    description: str
    source: str
    type: str


class ProjectionFeedRecurringItem(BaseModel):
    description: str
    amount: Decimal
    average_amount: Decimal
    type: str
    last_date: str
    month_count: int
    transaction_count: int
    category_id: str | None
    frequency: str


class ProjectionFeedCreditCardInstallmentItem(BaseModel):
    amount: Decimal
    description: str
    due_date: str


class ProjectionFeedVariableCategoryItem(BaseModel):
    category_id: str | None
    category_name: str
    current_month_spent: Decimal
    historical_monthly_amounts: list[Decimal]
    monthly_average: Decimal


class ProjectionFeedResponse(BaseModel):
    workspace_id: str
    current_balance: Decimal | None
    current_balance_date: date | None
    current_balance_account: str | None
    known_events: list[ProjectionFeedKnownEventItem]
    recurring_items: list[ProjectionFeedRecurringItem]
    credit_card_installments: list[ProjectionFeedCreditCardInstallmentItem]
    variable_categories: list[ProjectionFeedVariableCategoryItem]


@router.get("/summary")
def get_summary(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
) -> DashboardSummaryResponse:
    return DashboardSummaryResponse(
        **DashboardService(db).summary(
            workspace_id=auth.workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
    )


@router.get("/monthly-cashflow")
def get_monthly_cashflow(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
) -> MonthlyCashflowResponse:
    items = DashboardService(db).monthly_cashflow(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
    )
    return MonthlyCashflowResponse(workspace_id=auth.workspace_id, items=items)


@router.get("/daily-cashflow")
def get_daily_cashflow(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
) -> DailyCashflowResponse:
    items = DashboardService(db).daily_cashflow(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
    )
    return DailyCashflowResponse(workspace_id=auth.workspace_id, items=items)


@router.get("/category-ranking")
def get_category_ranking(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=10, ge=1, le=50),
) -> CategoryRankingResponse:
    items = DashboardService(db).category_ranking(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )
    return CategoryRankingResponse(workspace_id=auth.workspace_id, items=items)


@router.get("/subcategory-ranking")
def get_subcategory_ranking(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
    category_id: str | None = None,
    limit: int = Query(default=10, ge=1, le=50),
) -> SubcategoryRankingResponse:
    items = DashboardService(db).subcategory_ranking(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        limit=limit,
    )
    return SubcategoryRankingResponse(workspace_id=auth.workspace_id, items=items)


@router.get("/expense-size-profile")
def get_expense_size_profile(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
) -> ExpenseSizeProfileResponse:
    items = DashboardService(db).expense_size_profile(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
    )
    return ExpenseSizeProfileResponse(workspace_id=auth.workspace_id, items=items)


@router.get("/spending-breakdown")
def get_spending_breakdown(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
) -> SpendingBreakdownResponse:
    data = DashboardService(db).spending_breakdown(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
    )
    return SpendingBreakdownResponse(workspace_id=auth.workspace_id, **data)


@router.get("/category-trends")
def get_category_trends(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_to: date | None = None,
    months: int = Query(default=6, ge=2, le=12),
    limit: int = Query(default=8, ge=1, le=40),
) -> CategoryTrendsResponse:
    data = DashboardService(db).category_trends(
        workspace_id=auth.workspace_id,
        date_to=date_to,
        months=months,
        limit=limit,
    )
    return CategoryTrendsResponse(workspace_id=auth.workspace_id, **data)


@router.get("/merchant-ranking")
def get_merchant_ranking(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=8, ge=1, le=50),
) -> MerchantRankingResponse:
    items = DashboardService(db).merchant_ranking(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )
    return MerchantRankingResponse(workspace_id=auth.workspace_id, items=items)


@router.get("/recurring-expenses")
def get_recurring_expenses(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
    min_months: int = Query(default=3, ge=2, le=12),
    limit: int = Query(default=8, ge=1, le=50),
) -> RecurringExpensesResponse:
    items = DashboardService(db).recurring_expenses(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
        min_months=min_months,
        limit=limit,
    )
    return RecurringExpensesResponse(workspace_id=auth.workspace_id, items=items)


@router.get("/recurring-incomes")
def get_recurring_incomes(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
    min_months: int = Query(default=3, ge=2, le=12),
    limit: int = Query(default=8, ge=1, le=50),
) -> RecurringIncomesResponse:
    items = DashboardService(db).recurring_incomes(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
        min_months=min_months,
        limit=limit,
    )
    return RecurringIncomesResponse(workspace_id=auth.workspace_id, items=items)


@router.get("/category-growth-alerts")
def get_category_growth_alerts(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=3, ge=1, le=10),
) -> CategoryGrowthAlertsResponse:
    items = DashboardService(db).category_growth_alerts(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )
    return CategoryGrowthAlertsResponse(workspace_id=auth.workspace_id, items=items)


@router.get("/weekday-spending")
def get_weekday_spending(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
) -> WeekdaySpendingResponse:
    items = DashboardService(db).weekday_spending(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
    )
    return WeekdaySpendingResponse(workspace_id=auth.workspace_id, items=items)


@router.get("/data-quality")
def get_data_quality(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
) -> DataQualityResponse:
    return DataQualityResponse(
        **DashboardService(db).data_quality(
            workspace_id=auth.workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
    )


@router.get("/credit-card-payment-matches")
def get_credit_card_payment_matches(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
    window_days: int = Query(default=7, ge=0, le=31),
    limit: int = Query(default=20, ge=1, le=100),
) -> CreditCardPaymentMatchesResponse:
    items = DashboardService(db).credit_card_payment_matches(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
        window_days=window_days,
        limit=limit,
    )
    return CreditCardPaymentMatchesResponse(workspace_id=auth.workspace_id, items=items)


@router.get("/projection-feed")
def get_projection_feed(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    horizon_days: int = Query(default=90, ge=7, le=365),
    lookback_months: int = Query(default=3, ge=3, le=6),
) -> ProjectionFeedResponse:
    return ProjectionFeedResponse(
        **DashboardService(db).projection_feed(
            workspace_id=auth.workspace_id,
            horizon_days=horizon_days,
            lookback_months=lookback_months,
        )
    )


@router.get("/credit-card-installments")
def get_credit_card_installments(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=20, ge=1, le=100),
) -> CreditCardInstallmentsResponse:
    return CreditCardInstallmentsResponse(
        **DashboardService(db).credit_card_installments(
            workspace_id=auth.workspace_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )
    )
