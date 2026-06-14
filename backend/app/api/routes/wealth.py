from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import WealthItem
from app.db.session import get_db
from app.services.wealth_service import wealth_summary

router = APIRouter(tags=["wealth"])
DbDependency = Depends(get_db)

_KINDS = {"asset", "liability"}


class WealthItemCreate(BaseModel):
    kind: str = Field(max_length=16)
    label: str = Field(min_length=1, max_length=120)
    value: Decimal = Field(default=Decimal("0"))
    category: str | None = Field(default=None, max_length=24)
    note: str | None = Field(default=None, max_length=200)


class WealthItemUpdate(BaseModel):
    kind: str | None = Field(default=None, max_length=16)
    label: str | None = Field(default=None, min_length=1, max_length=120)
    value: Decimal | None = None
    category: str | None = Field(default=None, max_length=24)
    note: str | None = Field(default=None, max_length=200)


class WealthItemRead(BaseModel):
    id: str
    workspace_id: str
    kind: str
    label: str
    category: str | None
    value: Decimal
    note: str | None
    created_at: object
    updated_at: object


@router.get("/wealth")
def get_wealth(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> dict:
    return wealth_summary(db, auth.workspace_id)


@router.post("/wealth-items", status_code=status.HTTP_201_CREATED)
def create_wealth_item(
    payload: WealthItemCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> WealthItemRead:
    item = WealthItem(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        kind=_kind(payload.kind),
        label=_required(payload.label, "Label is required"),
        value=_non_negative(payload.value),
        category=_optional(payload.category),
        note=_optional(payload.note),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _read(item)


@router.patch("/wealth-items/{item_id}")
def update_wealth_item(
    item_id: str,
    payload: WealthItemUpdate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> WealthItemRead:
    item = _get_item(db, auth.workspace_id, item_id)
    if payload.kind is not None:
        item.kind = _kind(payload.kind)
    if payload.label is not None:
        item.label = _required(payload.label, "Label is required")
    if payload.value is not None:
        item.value = _non_negative(payload.value)
    if payload.category is not None:
        item.category = _optional(payload.category)
    if payload.note is not None:
        item.note = _optional(payload.note)
    item.updated_at = datetime.now(UTC)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _read(item)


@router.delete("/wealth-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wealth_item(
    item_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> None:
    item = _get_item(db, auth.workspace_id, item_id)
    db.delete(item)
    db.commit()
    return None


def _read(i: WealthItem) -> WealthItemRead:
    return WealthItemRead(
        id=i.id,
        workspace_id=i.workspace_id,
        kind=i.kind,
        label=i.label,
        category=i.category,
        value=i.value,
        note=i.note,
        created_at=i.created_at,
        updated_at=i.updated_at,
    )


def _get_item(db: Session, workspace_id: str, item_id: str) -> WealthItem:
    try:
        UUID(item_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid item id"
        ) from exc
    item = db.scalar(
        select(WealthItem).where(
            WealthItem.id == item_id, WealthItem.workspace_id == workspace_id
        )
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wealth item not found")
    return item


def _kind(value: str) -> str:
    v = value.strip().lower()
    if v not in _KINDS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="kind must be 'asset' or 'liability'",
        )
    return v


def _required(value: str, message: str) -> str:
    text = value.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)
    return text


def _optional(value: str | None) -> str | None:
    if value is None:
        return None
    return value.strip() or None


def _non_negative(value: Decimal) -> Decimal:
    if value < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="value must be >= 0"
        )
    return value
