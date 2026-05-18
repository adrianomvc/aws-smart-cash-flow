from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import (
    CategorizationRule,
    Category,
    TransactionCategoryAssignment,
)
from app.db.session import get_db
from app.services.categorization_service import CategorizationService

router = APIRouter(tags=["categories"])
DbDependency = Depends(get_db)


class CategoryCreate(BaseModel):
    name: str
    parent_category_id: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    parent_category_id: str | None = None


class CategorizationRuleCreate(BaseModel):
    name: str
    field: str
    match_type: str
    pattern: str
    category_id: str
    priority: int = 100
    active: bool = True


class CategorizationRuleUpdate(BaseModel):
    name: str | None = None
    field: str | None = None
    match_type: str | None = None
    pattern: str | None = None
    category_id: str | None = None
    priority: int | None = None
    active: bool | None = None


class CategoryRead(BaseModel):
    id: str
    name: str
    parent_category_id: str | None
    created_at: datetime


class CategoryListResponse(BaseModel):
    workspace_id: str
    items: list[CategoryRead]


class CategorizationRuleRead(BaseModel):
    id: str
    name: str
    field: str
    match_type: str
    pattern: str
    category_id: str
    priority: int
    active: bool
    created_at: datetime


class CategorizationRuleListResponse(BaseModel):
    workspace_id: str
    items: list[CategorizationRuleRead]


class ApplyRulesResponse(BaseModel):
    workspace_id: str
    applied_count: int


@router.get("/categories")
async def list_categories(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CategoryListResponse:
    categories = db.scalars(
        select(Category)
        .where(Category.workspace_id == auth.workspace_id)
        .order_by(Category.parent_category_id.is_not(None), Category.name, Category.id)
    ).all()
    return CategoryListResponse(
        workspace_id=auth.workspace_id,
        items=[_category_read(category) for category in _order_category_tree(categories)],
    )


@router.post("/categories")
async def create_category(
    payload: CategoryCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CategoryRead:
    _validate_parent_category(
        db=db,
        workspace_id=auth.workspace_id,
        category_id=payload.parent_category_id,
    )
    _ensure_category_name_available(
        db=db,
        workspace_id=auth.workspace_id,
        name=payload.name,
        parent_category_id=payload.parent_category_id,
    )
    category = Category(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name=payload.name,
        parent_category_id=payload.parent_category_id,
    )
    db.add(category)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category already exists in workspace",
        ) from exc
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
    if "parent_category_id" in payload.model_fields_set:
        if payload.parent_category_id is None:
            category.parent_category_id = None
        elif payload.parent_category_id == category_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category cannot be its own parent",
            )
        else:
            _validate_parent_category(
                db=db,
                workspace_id=auth.workspace_id,
                category_id=payload.parent_category_id,
            )
            category.parent_category_id = payload.parent_category_id
    if payload.name is not None:
        category.name = payload.name
    _ensure_category_name_available(
        db=db,
        workspace_id=auth.workspace_id,
        name=category.name,
        parent_category_id=category.parent_category_id,
        current_category_id=category_id,
    )

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category already exists in workspace",
        ) from exc
    db.refresh(category)
    return _category_read(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> None:
    category = _get_category(db=db, workspace_id=auth.workspace_id, category_id=category_id)
    in_use = db.scalar(
        select(TransactionCategoryAssignment.id).where(
            TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            TransactionCategoryAssignment.category_id == category_id,
        )
    )
    if in_use is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category is in use")
    has_children = db.scalar(
        select(Category.id).where(
            Category.workspace_id == auth.workspace_id,
            Category.parent_category_id == category_id,
        )
    )
    if has_children is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category has subcategories",
        )

    db.delete(category)
    db.commit()


@router.get("/categorization-rules")
async def list_rules(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CategorizationRuleListResponse:
    rules = db.scalars(
        select(CategorizationRule)
        .where(CategorizationRule.workspace_id == auth.workspace_id)
        .order_by(CategorizationRule.priority, CategorizationRule.created_at, CategorizationRule.id)
    ).all()
    return CategorizationRuleListResponse(
        workspace_id=auth.workspace_id,
        items=[_rule_read(rule) for rule in rules],
    )


@router.post("/categorization-rules")
async def create_rule(
    payload: CategorizationRuleCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CategorizationRuleRead:
    _validate_rule_values(field=payload.field, match_type=payload.match_type)
    _get_category(db=db, workspace_id=auth.workspace_id, category_id=payload.category_id)
    rule = CategorizationRule(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name=payload.name,
        field=payload.field,
        match_type=payload.match_type,
        pattern=payload.pattern,
        category_id=payload.category_id,
        priority=payload.priority,
        active=payload.active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _rule_read(rule)


@router.patch("/categorization-rules/{rule_id}")
async def update_rule(
    rule_id: str,
    payload: CategorizationRuleUpdate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CategorizationRuleRead:
    rule = _get_rule(db=db, workspace_id=auth.workspace_id, rule_id=rule_id)
    field = payload.field if payload.field is not None else rule.field
    match_type = payload.match_type if payload.match_type is not None else rule.match_type
    _validate_rule_values(field=field, match_type=match_type)
    if payload.category_id is not None:
        _get_category(db=db, workspace_id=auth.workspace_id, category_id=payload.category_id)
        rule.category_id = payload.category_id
    if payload.name is not None:
        rule.name = payload.name
    if payload.field is not None:
        rule.field = payload.field
    if payload.match_type is not None:
        rule.match_type = payload.match_type
    if payload.pattern is not None:
        rule.pattern = payload.pattern
    if payload.priority is not None:
        rule.priority = payload.priority
    if payload.active is not None:
        rule.active = payload.active

    db.commit()
    db.refresh(rule)
    return _rule_read(rule)


@router.delete("/categorization-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> None:
    rule = _get_rule(db=db, workspace_id=auth.workspace_id, rule_id=rule_id)
    db.delete(rule)
    db.commit()


@router.post("/categorization-rules/apply")
async def apply_rules(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> ApplyRulesResponse:
    applied_count = CategorizationService(db).apply_rules(auth.workspace_id)
    db.commit()
    return ApplyRulesResponse(workspace_id=auth.workspace_id, applied_count=applied_count)


def _category_read(category: Category) -> CategoryRead:
    return CategoryRead(
        id=category.id,
        name=category.name,
        parent_category_id=category.parent_category_id,
        created_at=category.created_at,
    )


def _order_category_tree(categories: list[Category]) -> list[Category]:
    by_parent: dict[str | None, list[Category]] = {}
    for category in categories:
        by_parent.setdefault(category.parent_category_id, []).append(category)
    for items in by_parent.values():
        items.sort(key=lambda category: (category.name.casefold(), category.id))

    ordered: list[Category] = []
    for root in by_parent.get(None, []):
        ordered.append(root)
        ordered.extend(by_parent.get(root.id, []))
    return ordered


def _rule_read(rule: CategorizationRule) -> CategorizationRuleRead:
    return CategorizationRuleRead(
        id=rule.id,
        name=rule.name,
        field=rule.field,
        match_type=rule.match_type,
        pattern=rule.pattern,
        category_id=rule.category_id,
        priority=rule.priority,
        active=rule.active,
        created_at=rule.created_at,
    )


def _get_category(db: Session, workspace_id: str, category_id: str) -> Category:
    category = db.scalar(
        select(Category).where(Category.id == category_id, Category.workspace_id == workspace_id)
    )
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category


def _get_rule(db: Session, workspace_id: str, rule_id: str) -> CategorizationRule:
    rule = db.scalar(
        select(CategorizationRule).where(
            CategorizationRule.id == rule_id,
            CategorizationRule.workspace_id == workspace_id,
        )
    )
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categorization rule not found",
        )
    return rule


def _validate_parent_category(
    db: Session,
    workspace_id: str,
    category_id: str | None,
) -> None:
    if category_id is None:
        return
    _get_category(db=db, workspace_id=workspace_id, category_id=category_id)


def _ensure_category_name_available(
    db: Session,
    workspace_id: str,
    name: str,
    parent_category_id: str | None,
    current_category_id: str | None = None,
) -> None:
    normalized_name = name.strip()
    query = select(Category).where(
        Category.workspace_id == workspace_id,
        Category.name == normalized_name,
    )
    if parent_category_id is None:
        query = query.where(Category.parent_category_id.is_(None))
    else:
        query = query.where(Category.parent_category_id == parent_category_id)
    if current_category_id is not None:
        query = query.where(Category.id != current_category_id)
    if db.scalar(query) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category already exists in workspace",
        )


def _validate_rule_values(field: str, match_type: str) -> None:
    if field not in {"description", "raw_description", "source_name"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid rule field")
    if match_type not in {"contains", "starts_with", "equals"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid match type")
