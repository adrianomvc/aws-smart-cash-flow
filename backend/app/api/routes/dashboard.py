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


class CategoryRankingResponse(BaseModel):
    workspace_id: str
    items: list[CategoryRankingItem]


class DataQualityResponse(BaseModel):
    workspace_id: str
    transaction_count: int
    categorized_count: int
    uncategorized_count: int
    categorized_ratio: Decimal | None
    imports_with_errors: int
    duplicate_imports: int


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
