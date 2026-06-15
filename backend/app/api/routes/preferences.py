from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import WorkspacePreferences
from app.db.session import get_db

router = APIRouter(tags=["preferences"])
DbDependency = Depends(get_db)

_ALLOWED_RISK = {"conservative", "moderate", "aggressive"}
_ALLOWED_WINDOW = {1, 3, 6, 12}


class PreferencesRead(BaseModel):
    workspace_id: str
    currency: str
    savings_target_pct: Decimal
    commitment_limit_pct: Decimal
    risk_profile: str
    burn_rate_window_months: int
    protected_reserve: Decimal


class PreferencesUpdate(BaseModel):
    currency: str | None = Field(default=None, max_length=8)
    savings_target_pct: Decimal | None = None
    commitment_limit_pct: Decimal | None = None
    risk_profile: str | None = Field(default=None, max_length=16)
    burn_rate_window_months: int | None = None
    protected_reserve: Decimal | None = None


def get_or_create_preferences(db: Session, workspace_id: str) -> WorkspacePreferences:
    prefs = db.get(WorkspacePreferences, workspace_id)
    if prefs is None:
        prefs = WorkspacePreferences(workspace_id=workspace_id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


def _read(prefs: WorkspacePreferences) -> PreferencesRead:
    return PreferencesRead(
        workspace_id=prefs.workspace_id,
        currency=prefs.currency,
        savings_target_pct=prefs.savings_target_pct,
        commitment_limit_pct=prefs.commitment_limit_pct,
        risk_profile=prefs.risk_profile,
        burn_rate_window_months=prefs.burn_rate_window_months,
        protected_reserve=prefs.protected_reserve,
    )


@router.get("/preferences")
def read_preferences(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> PreferencesRead:
    return _read(get_or_create_preferences(db, auth.workspace_id))


@router.patch("/preferences")
def update_preferences(
    payload: PreferencesUpdate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> PreferencesRead:
    prefs = get_or_create_preferences(db, auth.workspace_id)
    if payload.currency is not None:
        prefs.currency = payload.currency.strip() or "BRL"
    if payload.savings_target_pct is not None:
        prefs.savings_target_pct = _ratio(payload.savings_target_pct, "savings_target_pct")
    if payload.commitment_limit_pct is not None:
        prefs.commitment_limit_pct = _ratio(payload.commitment_limit_pct, "commitment_limit_pct")
    if payload.risk_profile is not None:
        if payload.risk_profile not in _ALLOWED_RISK:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid risk_profile"
            )
        prefs.risk_profile = payload.risk_profile
    if payload.burn_rate_window_months is not None:
        if payload.burn_rate_window_months not in _ALLOWED_WINDOW:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid burn_rate_window_months",
            )
        prefs.burn_rate_window_months = payload.burn_rate_window_months
    if payload.protected_reserve is not None:
        if payload.protected_reserve < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="protected_reserve must be >= 0",
            )
        prefs.protected_reserve = payload.protected_reserve
    db.commit()
    db.refresh(prefs)
    return _read(prefs)


def _ratio(value: Decimal, field: str) -> Decimal:
    if value < 0 or value > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} must be a ratio between 0 and 1",
        )
    return value
