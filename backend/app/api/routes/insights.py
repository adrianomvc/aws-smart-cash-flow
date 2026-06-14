from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.session import get_db
from app.services.insights_service import InsightsService

router = APIRouter(tags=["insights"])
DbDependency = Depends(get_db)


@router.get("/insights")
def get_insights(
    date_from: date | None = None,
    date_to: date | None = None,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> dict:
    return InsightsService(db).insights(
        workspace_id=auth.workspace_id,
        date_from=date_from,
        date_to=date_to,
    )
