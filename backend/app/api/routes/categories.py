from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import (
    CategorizationRule,
    Category,
    Transaction,
    TransactionCategoryAssignment,
)
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
    category_id: str | None = None
    target_direction: str | None = None
    priority: int = 100
    active: bool = True


class CategorizationRuleUpdate(BaseModel):
    name: str | None = None
    field: str | None = None
    match_type: str | None = None
    pattern: str | None = None
    category_id: str | None = None
    target_direction: str | None = None
    priority: int | None = None
    active: bool | None = None


class CategorizationRuleRead(BaseModel):
    id: str
    workspace_id: str
    name: str
    field: str
    match_type: str
    pattern: str
    category_id: str | None
    target_direction: str | None
    priority: int
    active: bool
    created_at: datetime


class CategorizationRuleListResponse(BaseModel):
    workspace_id: str
    items: list[CategorizationRuleRead]


class RuleApplyResponse(BaseModel):
    workspace_id: str
    applied_count: int
    category_applied_count: int
    direction_applied_count: int
    skipped_manual_count: int


class RulePreviewItem(BaseModel):
    transaction_id: str
    transaction_date: str
    description: str
    amount: str
    current_direction: str
    target_direction: str | None
    current_category_id: str | None
    target_category_id: str | None
    category_source: str | None
    would_change_category: bool
    would_change_direction: bool
    skipped_manual_category: bool


class RulePreviewResponse(BaseModel):
    workspace_id: str
    total_count: int
    change_count: int
    category_change_count: int
    direction_change_count: int
    skipped_manual_count: int
    items: list[RulePreviewItem]


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
        items=[_category_read(category) for category in _order_category_tree(list(categories))],
    )


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CategoryRead:
    name = _normalize_name(payload.name)
    _ensure_parent_category(
        db=db,
        workspace_id=auth.workspace_id,
        parent_category_id=payload.parent_category_id,
    )
    _ensure_unique_category_name(
        db=db,
        workspace_id=auth.workspace_id,
        name=name,
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
            parent_category_id=category.parent_category_id,
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
        _ensure_unique_category_name(
            db=db,
            workspace_id=auth.workspace_id,
            name=category.name,
            parent_category_id=payload.parent_category_id,
            exclude_category_id=category.id,
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
async def list_rules(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CategorizationRuleListResponse:
    rules = db.scalars(
        select(CategorizationRule)
        .where(CategorizationRule.workspace_id == auth.workspace_id)
        .order_by(CategorizationRule.priority, CategorizationRule.name, CategorizationRule.id)
    ).all()
    return CategorizationRuleListResponse(
        workspace_id=auth.workspace_id,
        items=[_rule_read(rule) for rule in rules],
    )


@router.post("/categorization-rules", status_code=status.HTTP_201_CREATED)
async def create_rule(
    payload: CategorizationRuleCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CategorizationRuleRead:
    _validate_rule_actions(payload.category_id, payload.target_direction)
    if payload.category_id is not None:
        _get_category(db=db, workspace_id=auth.workspace_id, category_id=payload.category_id)
    rule = CategorizationRule(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name=_normalize_name(payload.name),
        field=_validate_rule_field(payload.field),
        match_type=_validate_rule_match_type(payload.match_type),
        pattern=_normalize_rule_pattern(payload.pattern),
        category_id=payload.category_id,
        target_direction=_validate_target_direction(payload.target_direction),
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
    if payload.name is not None:
        rule.name = _normalize_name(payload.name)
    if payload.field is not None:
        rule.field = _validate_rule_field(payload.field)
    if payload.match_type is not None:
        rule.match_type = _validate_rule_match_type(payload.match_type)
    if payload.pattern is not None:
        rule.pattern = _normalize_rule_pattern(payload.pattern)
    if "category_id" in payload.model_fields_set and payload.category_id is not None:
        _get_category(db=db, workspace_id=auth.workspace_id, category_id=payload.category_id)
        rule.category_id = payload.category_id
    if "category_id" in payload.model_fields_set and payload.category_id is None:
        rule.category_id = None
    if "target_direction" in payload.model_fields_set:
        rule.target_direction = _validate_target_direction(payload.target_direction)
    if payload.priority is not None:
        rule.priority = payload.priority
    if payload.active is not None:
        rule.active = payload.active
    _validate_rule_actions(rule.category_id, rule.target_direction)

    db.commit()
    db.refresh(rule)
    return _rule_read(rule)


@router.get("/categorization-rules/{rule_id}/preview")
async def preview_rule(
    rule_id: str,
    limit: int = 10,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> RulePreviewResponse:
    rule = _get_rule(db=db, workspace_id=auth.workspace_id, rule_id=rule_id)
    return _preview_rule(db=db, workspace_id=auth.workspace_id, rule=rule, limit=limit)


@router.delete("/categorization-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> Response:
    rule = _get_rule(db=db, workspace_id=auth.workspace_id, rule_id=rule_id)
    db.delete(rule)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/categorization-rules/apply")
async def apply_rules(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> RuleApplyResponse:
    rules = db.scalars(
        select(CategorizationRule)
        .where(
            CategorizationRule.workspace_id == auth.workspace_id,
            CategorizationRule.active.is_(True),
        )
        .order_by(CategorizationRule.priority, CategorizationRule.id)
    ).all()
    transactions = db.scalars(
        select(Transaction)
        .where(Transaction.workspace_id == auth.workspace_id)
        .order_by(Transaction.transaction_date, Transaction.id)
    ).all()
    applied_count = 0
    category_applied_count = 0
    direction_applied_count = 0
    skipped_manual_count = 0

    for transaction in transactions:
        existing_assignment = db.scalar(
            select(TransactionCategoryAssignment).where(
                TransactionCategoryAssignment.workspace_id == auth.workspace_id,
                TransactionCategoryAssignment.transaction_id == transaction.id,
            )
        )

        matching_rule = next(
            (rule for rule in rules if _rule_matches_transaction(rule, transaction)),
            None,
        )
        if matching_rule is None:
            continue

        changed = False
        if (
            matching_rule.target_direction is not None
            and transaction.direction != matching_rule.target_direction
        ):
            transaction.direction = matching_rule.target_direction
            direction_applied_count += 1
            changed = True

        if matching_rule.category_id is not None:
            if existing_assignment is not None and existing_assignment.source == "manual":
                skipped_manual_count += 1
            elif existing_assignment is None:
                db.add(
                    TransactionCategoryAssignment(
                        id=str(uuid4()),
                        workspace_id=auth.workspace_id,
                        transaction_id=transaction.id,
                        category_id=matching_rule.category_id,
                        source="rule",
                        confidence=Decimal("1.0000"),
                        reason=f"Matched rule {matching_rule.name}",
                        review_status="accepted",
                    )
                )
                category_applied_count += 1
                changed = True
            elif existing_assignment.category_id != matching_rule.category_id:
                existing_assignment.category_id = matching_rule.category_id
                existing_assignment.source = "rule"
                existing_assignment.confidence = Decimal("1.0000")
                existing_assignment.reason = f"Matched rule {matching_rule.name}"
                existing_assignment.review_status = "accepted"
                category_applied_count += 1
                changed = True

        if changed:
            applied_count += 1

    db.commit()
    return RuleApplyResponse(
        workspace_id=auth.workspace_id,
        applied_count=applied_count,
        category_applied_count=category_applied_count,
        direction_applied_count=direction_applied_count,
        skipped_manual_count=skipped_manual_count,
    )


def _category_read(category: Category) -> CategoryRead:
    return CategoryRead(
        id=category.id,
        workspace_id=category.workspace_id,
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
        workspace_id=rule.workspace_id,
        name=rule.name,
        field=rule.field,
        match_type=rule.match_type,
        pattern=rule.pattern,
        category_id=rule.category_id,
        target_direction=rule.target_direction,
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
    parent_category_id: str | None,
    exclude_category_id: str | None = None,
) -> None:
    query = select(Category).where(Category.workspace_id == workspace_id, Category.name == name)
    if parent_category_id is None:
        query = query.where(Category.parent_category_id.is_(None))
    else:
        query = query.where(Category.parent_category_id == parent_category_id)
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


def _normalize_rule_pattern(pattern: str) -> str:
    normalized = _normalize_spaces(pattern)
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rule pattern is required",
        )
    return normalized


def _validate_rule_field(field: str) -> str:
    if field not in {"description", "raw_description", "source_name"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid rule field")
    return field


def _validate_rule_match_type(match_type: str) -> str:
    if match_type not in {"contains", "starts_with", "equals"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid rule match type",
        )
    return match_type


def _validate_target_direction(target_direction: str | None) -> str | None:
    if target_direction is None:
        return None
    if target_direction not in {"debit", "credit", "payment"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid rule target direction",
        )
    return target_direction


def _validate_rule_actions(category_id: str | None, target_direction: str | None) -> None:
    if category_id is None and target_direction is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rule must define a category or target direction",
        )


def _rule_matches_transaction(rule: CategorizationRule, transaction: Transaction) -> bool:
    raw_value = getattr(transaction, rule.field)
    if raw_value is None:
        return False

    value = _normalize_spaces(str(raw_value)).casefold()
    pattern = _normalize_spaces(rule.pattern).casefold()
    if rule.match_type == "contains":
        return pattern in value
    if rule.match_type == "starts_with":
        return value.startswith(pattern)
    if rule.match_type == "equals":
        return value == pattern
    return False


def _preview_rule(
    db: Session,
    workspace_id: str,
    rule: CategorizationRule,
    limit: int,
) -> RulePreviewResponse:
    resolved_limit = max(1, min(limit, 100))
    transactions = db.scalars(
        select(Transaction)
        .where(Transaction.workspace_id == workspace_id)
        .order_by(Transaction.transaction_date.desc(), Transaction.id)
    ).all()
    matching_transactions = [
        transaction for transaction in transactions if _rule_matches_transaction(rule, transaction)
    ]
    assignments = {
        assignment.transaction_id: assignment
        for assignment in db.scalars(
            select(TransactionCategoryAssignment).where(
                TransactionCategoryAssignment.workspace_id == workspace_id,
                TransactionCategoryAssignment.transaction_id.in_(
                    [transaction.id for transaction in matching_transactions]
                ),
            )
        ).all()
    }

    items = [
        _preview_item(
            transaction=transaction,
            assignment=assignments.get(transaction.id),
            rule=rule,
        )
        for transaction in matching_transactions
    ]
    return RulePreviewResponse(
        workspace_id=workspace_id,
        total_count=len(items),
        change_count=sum(
            1 for item in items if item.would_change_category or item.would_change_direction
        ),
        category_change_count=sum(1 for item in items if item.would_change_category),
        direction_change_count=sum(1 for item in items if item.would_change_direction),
        skipped_manual_count=sum(1 for item in items if item.skipped_manual_category),
        items=items[:resolved_limit],
    )


def _preview_item(
    transaction: Transaction,
    assignment: TransactionCategoryAssignment | None,
    rule: CategorizationRule,
) -> RulePreviewItem:
    current_category_id = assignment.category_id if assignment is not None else None
    category_source = assignment.source if assignment is not None else None
    skipped_manual = (
        rule.category_id is not None
        and assignment is not None
        and assignment.source == "manual"
        and assignment.category_id != rule.category_id
    )
    would_change_category = (
        rule.category_id is not None
        and not skipped_manual
        and current_category_id != rule.category_id
    )
    would_change_direction = (
        rule.target_direction is not None and transaction.direction != rule.target_direction
    )
    return RulePreviewItem(
        transaction_id=transaction.id,
        transaction_date=transaction.transaction_date.isoformat(),
        description=transaction.description,
        amount=str(transaction.amount),
        current_direction=transaction.direction,
        target_direction=rule.target_direction,
        current_category_id=current_category_id,
        target_category_id=rule.category_id,
        category_source=category_source,
        would_change_category=would_change_category,
        would_change_direction=would_change_direction,
        skipped_manual_category=skipped_manual,
    )


def _normalize_spaces(value: str) -> str:
    return " ".join(value.strip().split())
