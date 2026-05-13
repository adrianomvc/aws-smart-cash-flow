from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import CategorizationRule, Category, TransactionCategoryAssignment
from app.db.session import get_db

router = APIRouter(tags=["categories"])
DbDependency = Depends(get_db)


class CategoryCreate(BaseModel):
    name: str
    parent_category_id: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    parent_category_id: str | None = None


class CategoryRead(BaseModel):
    id: str
    workspace_id: str
    name: str
    parent_category_id: str | None
    created_at: datetime


class CategoryListResponse(BaseModel):
    workspace_id: str
    items: list[CategoryRead]


class CategorizationRuleCreate(BaseModel):
    name: str
    field: str
    match_type: str
    pattern: str
    category_id: str
    priority: int = 100
    active: bool = True


@router.get("/categories")
async def list_categories(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CategoryListResponse:
    categories = db.scalars(
        select(Category)
        .where(Category.workspace_id == auth.workspace_id)
        .order_by(Category.name, Category.id)
    ).all()
    return CategoryListResponse(
        workspace_id=auth.workspace_id,
        items=[_category_read(category) for category in categories],
    )


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CategoryRead:
    name = _normalize_name(payload.name)
    _ensure_unique_category_name(db=db, workspace_id=auth.workspace_id, name=name)
    _ensure_parent_category(
        db=db,
        workspace_id=auth.workspace_id,
        parent_category_id=payload.parent_category_id,
    )

    category = Category(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name=name,
        parent_category_id=payload.parent_category_id,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return _category_read(category)


@router.patch("/categories/{category_id}")
async def update_category(
    category_id: str,
    payload: CategoryUpdate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CategoryRead:
    category = _get_category(db=db, workspace_id=auth.workspace_id, category_id=category_id)
    if payload.name is not None:
        category.name = _normalize_name(payload.name)
        _ensure_unique_category_name(
            db=db,
            workspace_id=auth.workspace_id,
            name=category.name,
            exclude_category_id=category.id,
        )
    if "parent_category_id" in payload.model_fields_set:
        if payload.parent_category_id == category.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category cannot be its own parent",
            )
        _ensure_parent_category(
            db=db,
            workspace_id=auth.workspace_id,
            parent_category_id=payload.parent_category_id,
        )
        _ensure_no_parent_cycle(
            db=db,
            workspace_id=auth.workspace_id,
            category_id=category.id,
            parent_category_id=payload.parent_category_id,
        )
        category.parent_category_id = payload.parent_category_id

    db.commit()
    db.refresh(category)
    return _category_read(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> Response:
    category = _get_category(db=db, workspace_id=auth.workspace_id, category_id=category_id)
    child_category = db.scalar(
        select(Category).where(
            Category.workspace_id == auth.workspace_id,
            Category.parent_category_id == category.id,
        )
    )
    if child_category is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category has child categories",
        )
    assignment = db.scalar(
        select(TransactionCategoryAssignment).where(
            TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            TransactionCategoryAssignment.category_id == category.id,
        )
    )
    if assignment is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category is assigned to transactions",
        )
    rule = db.scalar(
        select(CategorizationRule).where(
            CategorizationRule.workspace_id == auth.workspace_id,
            CategorizationRule.category_id == category.id,
        )
    )
    if rule is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category is used by categorization rules",
        )

    db.delete(category)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/categorization-rules")
async def list_rules(auth: AuthContext = AuthDependency) -> dict[str, object]:
    return {"workspace_id": auth.workspace_id, "items": []}


@router.post("/categorization-rules")
async def create_rule(
    payload: CategorizationRuleCreate,
    auth: AuthContext = AuthDependency,
) -> dict[str, object]:
    return {"workspace_id": auth.workspace_id, **payload.model_dump()}


@router.post("/categorization-rules/apply")
async def apply_rules(auth: AuthContext = AuthDependency) -> dict[str, object]:
    return {"workspace_id": auth.workspace_id, "status": "queued"}


def _category_read(category: Category) -> CategoryRead:
    return CategoryRead(
        id=category.id,
        workspace_id=category.workspace_id,
        name=category.name,
        parent_category_id=category.parent_category_id,
        created_at=category.created_at,
    )


def _get_category(db: Session, workspace_id: str, category_id: str) -> Category:
    category = db.scalar(
        select(Category).where(Category.id == category_id, Category.workspace_id == workspace_id)
    )
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category


def _ensure_parent_category(
    db: Session,
    workspace_id: str,
    parent_category_id: str | None,
) -> None:
    if parent_category_id is None:
        return
    _get_category(db=db, workspace_id=workspace_id, category_id=parent_category_id)


def _ensure_no_parent_cycle(
    db: Session,
    workspace_id: str,
    category_id: str,
    parent_category_id: str | None,
) -> None:
    next_parent_id = parent_category_id
    while next_parent_id is not None:
        if next_parent_id == category_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category parent cycle is not allowed",
            )
        parent = _get_category(db=db, workspace_id=workspace_id, category_id=next_parent_id)
        next_parent_id = parent.parent_category_id


def _ensure_unique_category_name(
    db: Session,
    workspace_id: str,
    name: str,
    exclude_category_id: str | None = None,
) -> None:
    query = select(Category).where(Category.workspace_id == workspace_id, Category.name == name)
    if exclude_category_id is not None:
        query = query.where(Category.id != exclude_category_id)
    if db.scalar(query) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category name already exists",
        )


def _normalize_name(name: str) -> str:
    normalized = name.strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category name is required",
        )
    return normalized
