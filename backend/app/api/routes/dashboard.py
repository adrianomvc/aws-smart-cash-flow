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
    transaction_count: int


class MonthlyCashflowItem(BaseModel):
    month: str
    income: Decimal
    expenses: Decimal
    payments: Decimal
    balance: Decimal
    transaction_count: int


class MonthlyCashflowResponse(BaseModel):
    workspace_id: str
    items: list[MonthlyCashflowItem]


class CategoryRankingItem(BaseModel):
    category_id: str | None
    category_name: str
    amount: Decimal
    count: int
    share_ratio: Decimal | None
    average_amount: Decimal


class CategoryRankingResponse(BaseModel):
    workspace_id: str
    items: list[CategoryRankingItem]


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


@router.get("/summary")
async def get_summary(
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
async def get_monthly_cashflow(
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


@router.get("/category-ranking")
async def get_category_ranking(
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


@router.get("/merchant-ranking")
async def get_merchant_ranking(
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
async def get_recurring_expenses(
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


@router.get("/category-growth-alerts")
async def get_category_growth_alerts(
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
async def get_weekday_spending(
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
async def get_data_quality(
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
async def get_credit_card_payment_matches(
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


@router.get("/credit-card-installments")
async def get_credit_card_installments(
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
