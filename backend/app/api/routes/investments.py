from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import InvestmentAsset, InvestmentCustody, InvestmentSnapshot
from app.db.session import get_db
from app.services.investment_service import (
    ACCOUNT_TYPES,
    ASSET_CLASS_IDS,
    ASSET_CLASSES,
    position_summary,
)

router = APIRouter(tags=["investments"])
DbDependency = Depends(get_db)


# --------------------------------------------------------------------------- #
# Schemas
# --------------------------------------------------------------------------- #
class CustodyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: str | None = Field(default=None, max_length=80)
    account_type: str = Field(default="broker", max_length=16)
    brand: str | None = Field(default=None, max_length=8)
    color: str | None = Field(default=None, max_length=32)
    sync_mode: str | None = Field(default=None, max_length=60)


class CustodyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    kind: str | None = Field(default=None, max_length=80)
    account_type: str | None = Field(default=None, max_length=16)
    brand: str | None = Field(default=None, max_length=8)
    color: str | None = Field(default=None, max_length=32)
    sync_mode: str | None = Field(default=None, max_length=60)
    active: bool | None = None


class CustodyRead(BaseModel):
    id: str
    workspace_id: str
    name: str
    kind: str | None
    account_type: str
    brand: str | None
    color: str | None
    sync_mode: str | None
    active: bool
    created_at: object
    updated_at: object


class CustodyListResponse(BaseModel):
    workspace_id: str
    items: list[CustodyRead]
    total: int


class AssetCreate(BaseModel):
    custody_id: str
    name: str = Field(min_length=1, max_length=160)
    asset_class: str = Field(default="other", max_length=16)
    risk: str | None = Field(default=None, max_length=40)
    detail: str | None = Field(default=None, max_length=120)
    current_value: Decimal = Field(default=Decimal("0"))
    contributed: Decimal = Field(default=Decimal("0"))


class AssetUpdate(BaseModel):
    custody_id: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=160)
    asset_class: str | None = Field(default=None, max_length=16)
    risk: str | None = Field(default=None, max_length=40)
    detail: str | None = Field(default=None, max_length=120)
    current_value: Decimal | None = None
    contributed: Decimal | None = None
    active: bool | None = None


class AssetRead(BaseModel):
    id: str
    workspace_id: str
    custody_id: str
    name: str
    asset_class: str
    risk: str | None
    detail: str | None
    current_value: Decimal
    contributed: Decimal
    active: bool
    created_at: object
    updated_at: object


class AssetListResponse(BaseModel):
    workspace_id: str
    items: list[AssetRead]
    total: int


class SnapshotCreate(BaseModel):
    value: Decimal
    contributed: Decimal | None = None
    as_of: date | None = None


class SnapshotRead(BaseModel):
    id: str
    asset_id: str
    as_of: date
    value: Decimal
    contributed: Decimal | None
    created_at: object


class SnapshotListResponse(BaseModel):
    asset_id: str
    items: list[SnapshotRead]
    total: int


# --------------------------------------------------------------------------- #
# Reference + position
# --------------------------------------------------------------------------- #
@router.get("/investment-classes")
def list_investment_classes() -> dict:
    return {"items": ASSET_CLASSES}


@router.get("/investments/position")
def investments_position(
    as_of: date | None = None,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> dict:
    return position_summary(db, auth.workspace_id, as_of=as_of)


# --------------------------------------------------------------------------- #
# Custodies
# --------------------------------------------------------------------------- #
@router.get("/investment-custodies")
def list_custodies(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CustodyListResponse:
    rows = db.scalars(
        select(InvestmentCustody)
        .where(InvestmentCustody.workspace_id == auth.workspace_id)
        .order_by(InvestmentCustody.active.desc(), InvestmentCustody.name)
    ).all()
    return CustodyListResponse(
        workspace_id=auth.workspace_id,
        items=[_custody_read(r) for r in rows],
        total=len(rows),
    )


@router.post("/investment-custodies", status_code=status.HTTP_201_CREATED)
def create_custody(
    payload: CustodyCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CustodyRead:
    custody = InvestmentCustody(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name=_required(payload.name, "Custody name is required"),
        kind=_optional(payload.kind),
        account_type=_account_type(payload.account_type),
        brand=_optional(payload.brand),
        color=_optional(payload.color),
        sync_mode=_optional(payload.sync_mode),
    )
    db.add(custody)
    _commit_unique(db, "Custody already exists for this workspace")
    db.refresh(custody)
    return _custody_read(custody)


@router.patch("/investment-custodies/{custody_id}")
def update_custody(
    custody_id: str,
    payload: CustodyUpdate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CustodyRead:
    custody = _get_custody(db, auth.workspace_id, custody_id)
    if payload.name is not None:
        custody.name = _required(payload.name, "Custody name is required")
    if payload.kind is not None:
        custody.kind = _optional(payload.kind)
    if payload.account_type is not None:
        custody.account_type = _account_type(payload.account_type)
    if payload.brand is not None:
        custody.brand = _optional(payload.brand)
    if payload.color is not None:
        custody.color = _optional(payload.color)
    if payload.sync_mode is not None:
        custody.sync_mode = _optional(payload.sync_mode)
    if payload.active is not None:
        custody.active = payload.active
    custody.updated_at = _now()
    db.add(custody)
    _commit_unique(db, "Custody already exists for this workspace")
    db.refresh(custody)
    return _custody_read(custody)


@router.delete("/investment-custodies/{custody_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_custody(
    custody_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> None:
    custody = _get_custody(db, auth.workspace_id, custody_id)
    db.delete(custody)
    db.commit()
    return None


# --------------------------------------------------------------------------- #
# Assets
# --------------------------------------------------------------------------- #
@router.get("/investment-assets")
def list_assets(
    custody_id: str | None = None,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> AssetListResponse:
    query = select(InvestmentAsset).where(InvestmentAsset.workspace_id == auth.workspace_id)
    if custody_id is not None:
        query = query.where(InvestmentAsset.custody_id == custody_id)
    rows = db.scalars(query.order_by(InvestmentAsset.name)).all()
    return AssetListResponse(
        workspace_id=auth.workspace_id,
        items=[_asset_read(r) for r in rows],
        total=len(rows),
    )


@router.post("/investment-assets", status_code=status.HTTP_201_CREATED)
def create_asset(
    payload: AssetCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> AssetRead:
    _get_custody(db, auth.workspace_id, payload.custody_id)
    asset = InvestmentAsset(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        custody_id=payload.custody_id,
        name=_required(payload.name, "Asset name is required"),
        asset_class=_asset_class(payload.asset_class),
        risk=_optional(payload.risk),
        detail=_optional(payload.detail),
        current_value=_non_negative(payload.current_value, "Value must be >= 0"),
        contributed=_non_negative(payload.contributed, "Contributed must be >= 0"),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return _asset_read(asset)


@router.patch("/investment-assets/{asset_id}")
def update_asset(
    asset_id: str,
    payload: AssetUpdate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> AssetRead:
    asset = _get_asset(db, auth.workspace_id, asset_id)
    if payload.custody_id is not None:
        _get_custody(db, auth.workspace_id, payload.custody_id)
        asset.custody_id = payload.custody_id
    if payload.name is not None:
        asset.name = _required(payload.name, "Asset name is required")
    if payload.asset_class is not None:
        asset.asset_class = _asset_class(payload.asset_class)
    if payload.risk is not None:
        asset.risk = _optional(payload.risk)
    if payload.detail is not None:
        asset.detail = _optional(payload.detail)
    if payload.current_value is not None:
        asset.current_value = _non_negative(payload.current_value, "Value must be >= 0")
    if payload.contributed is not None:
        asset.contributed = _non_negative(payload.contributed, "Contributed must be >= 0")
    if payload.active is not None:
        asset.active = payload.active
    asset.updated_at = _now()
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return _asset_read(asset)


@router.delete("/investment-assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> None:
    asset = _get_asset(db, auth.workspace_id, asset_id)
    db.delete(asset)
    db.commit()
    return None


# --------------------------------------------------------------------------- #
# Snapshots
# --------------------------------------------------------------------------- #
@router.get("/investment-assets/{asset_id}/snapshots")
def list_snapshots(
    asset_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> SnapshotListResponse:
    asset = _get_asset(db, auth.workspace_id, asset_id)
    rows = db.scalars(
        select(InvestmentSnapshot)
        .where(InvestmentSnapshot.asset_id == asset.id)
        .order_by(InvestmentSnapshot.as_of.desc())
    ).all()
    return SnapshotListResponse(
        asset_id=asset.id,
        items=[_snapshot_read(r) for r in rows],
        total=len(rows),
    )


@router.post("/investment-assets/{asset_id}/snapshots", status_code=status.HTTP_201_CREATED)
def create_snapshot(
    asset_id: str,
    payload: SnapshotCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> SnapshotRead:
    """Record the value of a position on a date. Updates the asset's live
    value (and contributed, when given) and feeds the return calculation."""
    asset = _get_asset(db, auth.workspace_id, asset_id)
    as_of = payload.as_of or date.today()
    value = _non_negative(payload.value, "Value must be >= 0")
    contributed = (
        _non_negative(payload.contributed, "Contributed must be >= 0")
        if payload.contributed is not None
        else None
    )
    existing = db.scalar(
        select(InvestmentSnapshot).where(
            InvestmentSnapshot.asset_id == asset.id,
            InvestmentSnapshot.as_of == as_of,
        )
    )
    if existing is not None:
        existing.value = value
        if contributed is not None:
            existing.contributed = contributed
        snapshot = existing
    else:
        snapshot = InvestmentSnapshot(
            id=str(uuid4()),
            workspace_id=auth.workspace_id,
            asset_id=asset.id,
            as_of=as_of,
            value=value,
            contributed=contributed,
        )
        db.add(snapshot)
    # A snapshot dated today (or later) updates the asset's live position;
    # backfilled historical snapshots only feed the return history.
    if as_of >= date.today():
        asset.current_value = value
        if contributed is not None:
            asset.contributed = contributed
        asset.updated_at = _now()
    custody = db.get(InvestmentCustody, asset.custody_id)
    if custody is not None:
        custody.updated_at = _now()
    db.commit()
    db.refresh(snapshot)
    return _snapshot_read(snapshot)


@router.delete("/investment-snapshots/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_snapshot(
    snapshot_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> None:
    _validate_uuid(snapshot_id, "Invalid snapshot id")
    snapshot = db.scalar(
        select(InvestmentSnapshot).where(
            InvestmentSnapshot.id == snapshot_id,
            InvestmentSnapshot.workspace_id == auth.workspace_id,
        )
    )
    if snapshot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")
    db.delete(snapshot)
    db.commit()
    return None


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _custody_read(c: InvestmentCustody) -> CustodyRead:
    return CustodyRead(
        id=c.id,
        workspace_id=c.workspace_id,
        name=c.name,
        kind=c.kind,
        account_type=c.account_type,
        brand=c.brand,
        color=c.color,
        sync_mode=c.sync_mode,
        active=c.active,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


def _asset_read(a: InvestmentAsset) -> AssetRead:
    return AssetRead(
        id=a.id,
        workspace_id=a.workspace_id,
        custody_id=a.custody_id,
        name=a.name,
        asset_class=a.asset_class,
        risk=a.risk,
        detail=a.detail,
        current_value=a.current_value,
        contributed=a.contributed,
        active=a.active,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


def _snapshot_read(s: InvestmentSnapshot) -> SnapshotRead:
    return SnapshotRead(
        id=s.id,
        asset_id=s.asset_id,
        as_of=s.as_of,
        value=s.value,
        contributed=s.contributed,
        created_at=s.created_at,
    )


def _get_custody(db: Session, workspace_id: str, custody_id: str) -> InvestmentCustody:
    _validate_uuid(custody_id, "Invalid custody id")
    custody = db.scalar(
        select(InvestmentCustody).where(
            InvestmentCustody.id == custody_id,
            InvestmentCustody.workspace_id == workspace_id,
        )
    )
    if custody is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custody not found")
    return custody


def _get_asset(db: Session, workspace_id: str, asset_id: str) -> InvestmentAsset:
    _validate_uuid(asset_id, "Invalid asset id")
    asset = db.scalar(
        select(InvestmentAsset).where(
            InvestmentAsset.id == asset_id,
            InvestmentAsset.workspace_id == workspace_id,
        )
    )
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return asset


def _commit_unique(db: Session, message: str) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message) from exc


def _now() -> datetime:
    return datetime.now(UTC)


def _required(value: str, message: str) -> str:
    text = value.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)
    return text


def _optional(value: str | None) -> str | None:
    if value is None:
        return None
    return value.strip() or None


def _account_type(value: str) -> str:
    v = value.strip().lower()
    if v not in ACCOUNT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid account_type"
        )
    return v


def _asset_class(value: str) -> str:
    v = value.strip().lower()
    if v not in ASSET_CLASS_IDS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid asset_class"
        )
    return v


def _non_negative(value: Decimal, message: str) -> Decimal:
    if value < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)
    return value


def _validate_uuid(value: str, message: str) -> str:
    try:
        UUID(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message
        ) from exc
    return value
