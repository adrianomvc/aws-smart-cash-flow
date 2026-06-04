from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.session import get_db
from app.services.report_service import ReportService

router = APIRouter(tags=["reports"])
DbDependency = Depends(get_db)


class ReportCardRead(BaseModel):
    id: str = Field(max_length=80)
    title: str = Field(max_length=120)
    description: str = Field(max_length=280)
    status: str = Field(max_length=24)
    primary_metric: str = Field(max_length=80)
    secondary_metric: str = Field(max_length=120)
    target_page: str = Field(max_length=40)


class ReportListResponse(BaseModel):
    workspace_id: str
    date_from: date | None
    date_to: date | None
    export_status: str
    items: list[ReportCardRead]


@router.get("/reports")
async def list_reports(
    date_from: date | None = None,
    date_to: date | None = None,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> ReportListResponse:
    reports = ReportService(db).reports(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
    )
    return ReportListResponse(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
        export_status="coming_soon",
        items=[ReportCardRead(**report.__dict__) for report in reports],
    )

