import re
from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import (
    CategorizationRule,
    Category,
    MerchantAlias,
    Transaction,
    TransactionCategoryAssignment,
)
from app.db.session import get_db

router = APIRouter(tags=["categories"])
DbDependency = Depends(get_db)


class CategoryCreate(BaseModel):
    name: str
    parent_category_id: str | None = None
    color: str | None = None
    icon: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    parent_category_id: str | None = None
    color: str | None = None
    icon: str | None = None


class CategoryRead(BaseModel):
    id: str
    workspace_id: str
    name: str
    parent_category_id: str | None
    color: str | None
    icon: str | None
    created_at: datetime


class CategoryListResponse(BaseModel):
    workspace_id: str
    items: list[CategoryRead]


class CategorizationRuleCreate(BaseModel):
    name: str
    field: str
    match_type: str
    pattern: str = ""
    category_id: str | None = None
    target_direction: str | None = None
    priority: int = 100
    active: bool = True
    # amount_recurring fields
    amount_ref: Decimal | None = None
    amount_tolerance: Decimal | None = None
    day_min: int | None = None
    day_max: int | None = None
    direction_filter: str | None = None
    origin: str = "manual"


class CategorizationRuleUpdate(BaseModel):
    name: str | None = None
    field: str | None = None
    match_type: str | None = None
    pattern: str | None = None
    category_id: str | None = None
    target_direction: str | None = None
    priority: int | None = None
    active: bool | None = None
    amount_ref: Decimal | None = None
    amount_tolerance: Decimal | None = None
    day_min: int | None = None
    day_max: int | None = None
    direction_filter: str | None = None


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
    amount_ref: Decimal | None
    amount_tolerance: Decimal | None
    day_min: int | None
    day_max: int | None
    direction_filter: str | None
    origin: str
    created_at: datetime


class CategorizationRuleListResponse(BaseModel):
    workspace_id: str
    items: list[CategorizationRuleRead]


class MerchantAliasCreate(BaseModel):
    pattern: str
    replacement: str
    match_type: str = "contains"
    active: bool = True


class MerchantAliasUpdate(BaseModel):
    pattern: str | None = None
    replacement: str | None = None
    match_type: str | None = None
    active: bool | None = None


class MerchantAliasRead(BaseModel):
    id: str
    workspace_id: str
    pattern: str
    replacement: str
    match_type: str
    active: bool
    created_at: datetime


class MerchantAliasListResponse(BaseModel):
    workspace_id: str
    items: list[MerchantAliasRead]


class CategoryPatch(BaseModel):
    category_id: str | None


class RuleApplyResponse(BaseModel):
    workspace_id: str
    applied_count: int
    category_applied_count: int
    direction_applied_count: int
    skipped_manual_count: int


class GenerateAiRulesResponse(BaseModel):
    workspace_id: str
    created_count: int
    skipped_existing_count: int
    candidate_count: int


class AiSuggestionItem(BaseModel):
    pattern: str
    category_id: str
    count: int
    high_confidence: bool
    sample_description: str
    has_rule: bool


class AiSuggestionsResponse(BaseModel):
    workspace_id: str
    items: list[AiSuggestionItem]
    high_confidence_candidate_count: int


class RecurringCluster(BaseModel):
    amount: Decimal
    day_min: int
    day_max: int
    count: int
    sample_description: str
    suggested_rule_name: str


class RecurringClustersResponse(BaseModel):
    workspace_id: str
    clusters: list[RecurringCluster]


class RuleSuggestion(BaseModel):
    match_type: str
    field: str
    pattern: str
    amount_ref: Decimal | None
    amount_tolerance: Decimal | None
    day_min: int | None
    day_max: int | None
    direction_filter: str | None
    suggested_name: str
    affected_count: int


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
        color=_normalize_color(payload.color),
        icon=_normalize_icon(payload.icon),
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
    if "color" in payload.model_fields_set:
        category.color = _normalize_color(payload.color)
    if "icon" in payload.model_fields_set:
        category.icon = _normalize_icon(payload.icon)

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
    # Deleting a category uncategorizes its transactions (removes assignments).
    db.execute(
        delete(TransactionCategoryAssignment).where(
            TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            TransactionCategoryAssignment.category_id == category.id,
        )
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
    match_type = _validate_rule_match_type(payload.match_type)
    if payload.category_id is not None:
        _get_category(db=db, workspace_id=auth.workspace_id, category_id=payload.category_id)
    rule = CategorizationRule(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name=_normalize_name(payload.name),
        field=_validate_rule_field(payload.field),
        match_type=match_type,
        pattern=_normalize_rule_pattern(payload.pattern, match_type),
        category_id=payload.category_id,
        target_direction=_validate_target_direction(payload.target_direction),
        priority=payload.priority,
        active=payload.active,
        amount_ref=payload.amount_ref,
        amount_tolerance=payload.amount_tolerance,
        day_min=payload.day_min,
        day_max=payload.day_max,
        direction_filter=_validate_target_direction(payload.direction_filter),
        origin=_validate_rule_origin(payload.origin),
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
        rule.pattern = _normalize_rule_pattern(payload.pattern, rule.match_type)
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
    if "amount_ref" in payload.model_fields_set:
        rule.amount_ref = payload.amount_ref
    if "amount_tolerance" in payload.model_fields_set:
        rule.amount_tolerance = payload.amount_tolerance
    if "day_min" in payload.model_fields_set:
        rule.day_min = payload.day_min
    if "day_max" in payload.model_fields_set:
        rule.day_max = payload.day_max
    if "direction_filter" in payload.model_fields_set:
        rule.direction_filter = _validate_target_direction(payload.direction_filter)
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


@router.get("/merchant-aliases")
async def list_merchant_aliases(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> MerchantAliasListResponse:
    aliases = db.scalars(
        select(MerchantAlias)
        .where(MerchantAlias.workspace_id == auth.workspace_id)
        .order_by(MerchantAlias.replacement, MerchantAlias.id)
    ).all()
    return MerchantAliasListResponse(
        workspace_id=auth.workspace_id,
        items=[_alias_read(alias) for alias in aliases],
    )


@router.post("/merchant-aliases", status_code=status.HTTP_201_CREATED)
async def create_merchant_alias(
    payload: MerchantAliasCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> MerchantAliasRead:
    pattern = _normalize_alias_text(payload.pattern, "Alias pattern is required")
    replacement = _normalize_alias_text(payload.replacement, "Alias replacement is required")
    _ensure_unique_alias_pattern(db=db, workspace_id=auth.workspace_id, pattern=pattern)
    alias = MerchantAlias(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        pattern=pattern,
        replacement=replacement,
        match_type=_validate_alias_match_type(payload.match_type),
        active=payload.active,
    )
    db.add(alias)
    db.commit()
    db.refresh(alias)
    return _alias_read(alias)


@router.patch("/merchant-aliases/{alias_id}")
async def update_merchant_alias(
    alias_id: str,
    payload: MerchantAliasUpdate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> MerchantAliasRead:
    alias = _get_alias(db=db, workspace_id=auth.workspace_id, alias_id=alias_id)
    if payload.pattern is not None:
        pattern = _normalize_alias_text(payload.pattern, "Alias pattern is required")
        _ensure_unique_alias_pattern(
            db=db, workspace_id=auth.workspace_id, pattern=pattern, exclude_alias_id=alias.id
        )
        alias.pattern = pattern
    if payload.replacement is not None:
        alias.replacement = _normalize_alias_text(
            payload.replacement, "Alias replacement is required"
        )
    if payload.match_type is not None:
        alias.match_type = _validate_alias_match_type(payload.match_type)
    if payload.active is not None:
        alias.active = payload.active
    db.commit()
    db.refresh(alias)
    return _alias_read(alias)


@router.delete("/merchant-aliases/{alias_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_merchant_alias(
    alias_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> Response:
    alias = _get_alias(db=db, workspace_id=auth.workspace_id, alias_id=alias_id)
    db.delete(alias)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _extract_ai_regex(reason: str | None) -> str | None:
    match = re.search(r"regex sugerido:\s*(.+)$", reason or "")
    value = match.group(1).strip() if match else ""
    if not value or value.lower() == "null":
        return None
    try:
        re.compile(value)
    except re.error:
        return None
    return value


@router.get("/categorization-rules/ai-suggestions")
async def list_ai_suggestions(
    confidence: str = "high",
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> AiSuggestionsResponse:
    """AI categorizations grouped by suggested regex + category, so each can be
    reviewed and turned into a rule. confidence=high → only accepted (auto-applied)
    suggestions; confidence=all → also the ones still pending review."""
    statuses = ["accepted"] if confidence != "all" else ["accepted", "pending"]
    rows = db.execute(
        select(
            Transaction.description,
            TransactionCategoryAssignment.category_id,
            TransactionCategoryAssignment.reason,
            TransactionCategoryAssignment.review_status,
        )
        .join(
            TransactionCategoryAssignment,
            TransactionCategoryAssignment.transaction_id == Transaction.id,
        )
        .where(
            TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            TransactionCategoryAssignment.source == "llm",
            TransactionCategoryAssignment.review_status.in_(statuses),
        )
    ).all()
    existing_patterns = {
        pattern
        for (pattern,) in db.execute(
            select(CategorizationRule.pattern).where(
                CategorizationRule.workspace_id == auth.workspace_id
            )
        ).all()
    }

    groups: dict[tuple[str, str], dict] = {}
    high_candidates: set[tuple[str, str]] = set()
    for description, category_id, reason, review_status in rows:
        if not category_id:
            continue
        regex = _extract_ai_regex(reason)
        if not regex:
            continue
        key = (regex, category_id)
        group = groups.setdefault(
            key,
            {"count": 0, "high": False, "sample": description or regex},
        )
        group["count"] += 1
        if review_status == "accepted":
            group["high"] = True
            if regex not in existing_patterns:
                high_candidates.add(key)

    items = [
        AiSuggestionItem(
            pattern=regex,
            category_id=category_id,
            count=group["count"],
            high_confidence=group["high"],
            sample_description=group["sample"],
            has_rule=regex in existing_patterns,
        )
        for (regex, category_id), group in groups.items()
    ]
    items.sort(key=lambda item: (item.has_rule, -item.count))
    return AiSuggestionsResponse(
        workspace_id=auth.workspace_id,
        items=items,
        high_confidence_candidate_count=len(high_candidates),
    )


@router.post("/categorization-rules/generate-from-ai")
async def generate_rules_from_ai(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> GenerateAiRulesResponse:
    """Create rules (origin=ai, regex) from the high-confidence AI suggestions,
    deduplicated by pattern and skipping patterns that already have a rule."""
    rows = db.execute(
        select(
            Transaction.description,
            TransactionCategoryAssignment.category_id,
            TransactionCategoryAssignment.reason,
        )
        .join(
            TransactionCategoryAssignment,
            TransactionCategoryAssignment.transaction_id == Transaction.id,
        )
        .where(
            TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            TransactionCategoryAssignment.source == "llm",
            TransactionCategoryAssignment.review_status == "accepted",
        )
    ).all()
    existing_patterns = {
        pattern
        for (pattern,) in db.execute(
            select(CategorizationRule.pattern).where(
                CategorizationRule.workspace_id == auth.workspace_id
            )
        ).all()
    }

    candidates: dict[tuple[str, str], str] = {}
    for description, category_id, reason in rows:
        if not category_id:
            continue
        regex = _extract_ai_regex(reason)
        if regex:
            candidates.setdefault((regex, category_id), description or regex)

    created = 0
    skipped = 0
    for (regex, category_id), sample in candidates.items():
        if regex in existing_patterns:
            skipped += 1
            continue
        db.add(
            CategorizationRule(
                id=str(uuid4()),
                workspace_id=auth.workspace_id,
                name=f"IA: {(sample or regex)[:40]}",
                field="description",
                match_type="regex",
                pattern=regex,
                category_id=category_id,
                priority=60,
                active=True,
                origin="ai",
            )
        )
        existing_patterns.add(regex)
        created += 1
    db.commit()
    return GenerateAiRulesResponse(
        workspace_id=auth.workspace_id,
        created_count=created,
        skipped_existing_count=skipped,
        candidate_count=len(candidates),
    )


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
    if not rules:
        return RuleApplyResponse(
            workspace_id=auth.workspace_id,
            applied_count=0,
            category_applied_count=0,
            direction_applied_count=0,
            skipped_manual_count=0,
        )

    fields_used = sorted({rule.field for rule in rules})
    # amount_recurring rules match on the value + day of month, so those columns
    # must be loaded too (only when such a rule exists, to keep the lean path lean).
    has_amount_recurring = any(rule.match_type == "amount_recurring" for rule in rules)
    extra_columns = (
        [Transaction.amount, Transaction.transaction_date] if has_amount_recurring else []
    )

    # Fetch only the columns the rules read, as plain rows instead of ORM
    # instances. Hydrating every Transaction in the workspace used to exhaust
    # the Lambda's memory and CPU budget (API Gateway then cut the request at
    # ~29s, surfacing as "Failed to fetch" in the browser).
    transactions = db.execute(
        select(
            Transaction.id,
            Transaction.direction,
            *(getattr(Transaction, field) for field in fields_used),
            *extra_columns,
        ).where(Transaction.workspace_id == auth.workspace_id)
    ).all()

    # Batch-load existing assignments in a single query to avoid an N+1 query
    # pattern (one DB round-trip per transaction) against the remote database.
    existing_assignments = {
        row.transaction_id: row
        for row in db.execute(
            select(
                TransactionCategoryAssignment.id,
                TransactionCategoryAssignment.transaction_id,
                TransactionCategoryAssignment.category_id,
                TransactionCategoryAssignment.source,
            ).where(
                TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            )
        ).all()
    }

    # Pre-normalize each rule's pattern once (instead of once per transaction)
    # and remember which transaction fields the rules read. With many rules this
    # turns ~N_transactions * N_rules string normalizations into ~N_rules.
    compiled_rules = [
        (rule, _normalize_spaces(rule.pattern).casefold(), rule.match_type, rule.field)
        for rule in rules
    ]

    applied_count = 0
    category_applied_count = 0
    direction_applied_count = 0
    skipped_manual_count = 0

    # Accumulate writes and flush them in bulk after the matching loop instead
    # of mutating ORM objects one by one.
    direction_changes: dict[str, list[str]] = {}
    new_assignments: list[dict] = []
    assignment_updates: list[dict] = []

    for transaction in transactions:
        existing_assignment = existing_assignments.get(transaction.id)

        # Normalize the transaction's fields once, then reuse for every rule.
        row_mapping = transaction._mapping
        norm_fields: dict[str, str | None] = {}
        for field in fields_used:
            raw = row_mapping.get(field)
            norm_fields[field] = None if raw is None else _normalize_spaces(str(raw)).casefold()

        matching_rule = None
        for rule, pattern, match_type, field in compiled_rules:
            value = norm_fields.get(field)
            if match_type == "amount_recurring":
                # value/pattern optional text constraint; amount + day are required.
                matched = _row_matches_amount_recurring(
                    rule=rule,
                    amount=row_mapping.get("amount"),
                    transaction_date=row_mapping.get("transaction_date"),
                    direction=transaction.direction,
                    value=value,
                    pattern=pattern,
                )
            elif value is None:
                continue
            elif match_type == "contains":
                matched = pattern in value
            elif match_type == "starts_with":
                matched = value.startswith(pattern)
            elif match_type == "equals":
                matched = value == pattern
            elif match_type == "regex":
                try:
                    matched = bool(re.search(pattern, value))
                except re.error:
                    matched = False
            else:
                matched = False
            if matched:
                matching_rule = rule
                break
        if matching_rule is None:
            continue

        changed = False
        if (
            matching_rule.target_direction is not None
            and transaction.direction != matching_rule.target_direction
        ):
            direction_changes.setdefault(matching_rule.target_direction, []).append(
                transaction.id
            )
            direction_applied_count += 1
            changed = True

        if matching_rule.category_id is not None:
            if existing_assignment is not None and existing_assignment.source == "manual":
                skipped_manual_count += 1
            elif existing_assignment is None:
                new_assignments.append(
                    {
                        "id": str(uuid4()),
                        "workspace_id": auth.workspace_id,
                        "transaction_id": transaction.id,
                        "category_id": matching_rule.category_id,
                        "source": "rule",
                        "confidence": Decimal("1.0000"),
                        "reason": f"Matched rule {matching_rule.name}",
                        "review_status": "accepted",
                    }
                )
                category_applied_count += 1
                changed = True
            elif existing_assignment.category_id != matching_rule.category_id:
                assignment_updates.append(
                    {
                        "id": existing_assignment.id,
                        "category_id": matching_rule.category_id,
                        "source": "rule",
                        "confidence": Decimal("1.0000"),
                        "reason": f"Matched rule {matching_rule.name}",
                        "review_status": "accepted",
                    }
                )
                category_applied_count += 1
                changed = True

        if changed:
            applied_count += 1

    for direction, transaction_ids in direction_changes.items():
        for chunk_start in range(0, len(transaction_ids), 1000):
            chunk = transaction_ids[chunk_start : chunk_start + 1000]
            db.execute(
                update(Transaction)
                .where(Transaction.id.in_(chunk))
                .values(direction=direction)
                .execution_options(synchronize_session=False)
            )
    if new_assignments:
        db.execute(insert(TransactionCategoryAssignment), new_assignments)
    if assignment_updates:
        db.execute(update(TransactionCategoryAssignment), assignment_updates)
    db.commit()
    return RuleApplyResponse(
        workspace_id=auth.workspace_id,
        applied_count=applied_count,
        category_applied_count=category_applied_count,
        direction_applied_count=direction_applied_count,
        skipped_manual_count=skipped_manual_count,
    )


class PendingReviewItem(BaseModel):
    transaction_id: str
    transaction_date: str
    description: str
    amount: Decimal
    direction: str
    category_id: str
    source: str
    confidence: Decimal | None
    reason: str | None
    review_status: str


class PendingReviewResponse(BaseModel):
    workspace_id: str
    items: list[PendingReviewItem]
    total: int


class BatchCategorizationResponse(BaseModel):
    workspace_id: str
    trgm_applied: int
    llm_applied: int
    total_applied: int


@router.post("/categorize-pending")
async def categorize_pending(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> BatchCategorizationResponse:
    """Run trgm memory (Stage 2a) then LLM batch (Stage 4) on all uncategorized transactions."""
    from app.services.categorization_service import CategorizationService
    from app.services.llm_categorization_service import LLMCategorizationService

    # Trigram memory is a best-effort stage: if it is unavailable (no pg_trgm /
    # non-PostgreSQL engine) or has no categorized history to learn from, it must
    # never block the LLM fallback that follows.
    try:
        trgm = CategorizationService(db).apply_trgm_memory(auth.workspace_id)
    except Exception:  # noqa: BLE001 - degrade gracefully into the LLM stage
        db.rollback()
        trgm = 0
    llm = LLMCategorizationService(db).apply_llm_batch(auth.workspace_id)
    db.commit()
    return BatchCategorizationResponse(
        workspace_id=auth.workspace_id,
        trgm_applied=trgm,
        llm_applied=llm,
        total_applied=trgm + llm,
    )


@router.get("/pending-review")
async def list_pending_review(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    limit: int = 50,
    offset: int = 0,
) -> PendingReviewResponse:
    """List AI/trgm suggestions waiting for user review."""
    total = db.scalar(
        select(func.count(TransactionCategoryAssignment.id)).where(
            TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            TransactionCategoryAssignment.review_status == "pending",
        )
    ) or 0
    rows = db.execute(
        select(Transaction, TransactionCategoryAssignment)
        .join(
            TransactionCategoryAssignment,
            TransactionCategoryAssignment.transaction_id == Transaction.id,
        )
        .where(
            TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            TransactionCategoryAssignment.review_status == "pending",
        )
        .order_by(Transaction.transaction_date.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    items = [
        PendingReviewItem(
            transaction_id=t.id,
            transaction_date=t.transaction_date.isoformat(),
            description=t.description,
            amount=t.amount,
            direction=t.direction,
            category_id=a.category_id,
            source=a.source,
            confidence=a.confidence,
            reason=a.reason,
            review_status=a.review_status,
        )
        for t, a in rows
    ]
    return PendingReviewResponse(workspace_id=auth.workspace_id, items=items, total=total)


@router.post("/pending-review/{transaction_id}/accept")
async def accept_pending_review(
    transaction_id: str,
    create_rule: bool = False,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> dict:
    """Accept an AI suggestion. Optionally create a rule from the LLM regex suggestion."""
    assignment = db.scalar(
        select(TransactionCategoryAssignment).where(
            TransactionCategoryAssignment.transaction_id == transaction_id,
            TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            TransactionCategoryAssignment.review_status == "pending",
        )
    )
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pending review not found"
        )

    assignment.review_status = "accepted"

    rule_created = False
    if create_rule and assignment.source == "llm" and assignment.reason:
        # extract regex from reason field ("IA Gemini | regex sugerido: ^spotify")
        import re as _re
        match = _re.search(r"regex sugerido: (.+)$", assignment.reason or "")
        if match:
            regex_pattern = match.group(1).strip()
            transaction = db.scalar(
                select(Transaction).where(Transaction.id == transaction_id)
            )
            if transaction:
                rule = CategorizationRule(
                    id=str(uuid4()),
                    workspace_id=auth.workspace_id,
                    name=f"Auto IA: {transaction.description[:40]}",
                    field="description",
                    match_type="regex",
                    pattern=regex_pattern,
                    category_id=assignment.category_id,
                    priority=50,
                    active=True,
                    origin="ai",
                )
                db.add(rule)
                rule_created = True

    db.commit()
    return {"accepted": True, "rule_created": rule_created}


@router.post("/pending-review/{transaction_id}/correct")
async def correct_pending_review(
    transaction_id: str,
    payload: "CategoryPatch",
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> dict:
    """Correct an AI suggestion with a different category (marks as manual)."""
    assignment = db.scalar(
        select(TransactionCategoryAssignment).where(
            TransactionCategoryAssignment.transaction_id == transaction_id,
            TransactionCategoryAssignment.workspace_id == auth.workspace_id,
        )
    )
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    if payload.category_id is None:
        db.delete(assignment)
    else:
        _get_category(db=db, workspace_id=auth.workspace_id, category_id=payload.category_id)
        assignment.category_id = payload.category_id
        assignment.source = "manual"
        assignment.confidence = Decimal("1.0")
        assignment.reason = "Corrigido pelo usuário"
        assignment.review_status = "corrected"
    db.commit()
    return {"corrected": True}


@router.get("/categorization-rules/recurring-clusters")
async def detect_recurring_clusters(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
    min_occurrences: int = 4,
    max_day_spread: int = 6,
) -> RecurringClustersResponse:
    """Detect recurring fixed-amount transactions (boletos, insurance, etc.) not yet categorized."""
    rows = db.execute(
        select(
            Transaction.amount,
            func.min(Transaction.transaction_date).label("first_date"),
            func.max(Transaction.transaction_date).label("last_date"),
            func.count(Transaction.id).label("cnt"),
            func.min(Transaction.raw_description).label("sample_desc"),
            func.array_agg(func.extract("day", Transaction.transaction_date)).label("days"),
        )
        .outerjoin(
            TransactionCategoryAssignment,
            (TransactionCategoryAssignment.transaction_id == Transaction.id)
            & (TransactionCategoryAssignment.workspace_id == Transaction.workspace_id),
        )
        .where(
            Transaction.workspace_id == auth.workspace_id,
            Transaction.direction == "debit",
            TransactionCategoryAssignment.id.is_(None),
        )
        .group_by(Transaction.amount)
        .having(func.count(Transaction.id) >= min_occurrences)
    ).all()

    clusters: list[RecurringCluster] = []
    for row in rows:
        days = [int(d) for d in (row.days or []) if d is not None]
        if not days:
            continue
        day_min, day_max = min(days), max(days)
        if day_max - day_min > max_day_spread:
            continue
        distinct_months = db.scalar(
            select(func.count(func.distinct(
                func.to_char(Transaction.transaction_date, "YYYY-MM")
            ))).where(
                Transaction.workspace_id == auth.workspace_id,
                Transaction.amount == row.amount,
                Transaction.direction == "debit",
            )
        ) or 0
        if distinct_months < min_occurrences:
            continue
        clusters.append(RecurringCluster(
            amount=row.amount,
            day_min=day_min,
            day_max=day_max,
            count=row.cnt,
            sample_description=row.sample_desc or "",
            suggested_rule_name=f"Recorrente R$ {float(row.amount):.2f} dia {day_min}-{day_max}",
        ))

    clusters.sort(key=lambda c: c.count, reverse=True)
    return RecurringClustersResponse(workspace_id=auth.workspace_id, clusters=clusters)


@router.get("/categorization-rules/suggest-from-transaction/{transaction_id}")
async def suggest_rule_from_transaction(
    transaction_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> RuleSuggestion:
    """Given a manually-categorized transaction, suggest an auto-rule for it."""
    transaction = db.scalar(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.workspace_id == auth.workspace_id,
        )
    )
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    desc = transaction.description or ""
    tokens = desc.split()

    # heuristic: build a regex from first 1-3 meaningful tokens
    meaningful = [t for t in tokens if len(t) > 1][:3]
    pattern = (
        "^" + r"\s+".join(re.escape(t.lower()) for t in meaningful)
        if meaningful
        else desc.lower()
    )

    affected = db.scalar(
        select(func.count(Transaction.id)).where(
            Transaction.workspace_id == auth.workspace_id,
            Transaction.description.ilike(f"{' '.join(meaningful[:2])}%"),
        )
    ) or 0

    return RuleSuggestion(
        match_type="regex",
        field="description",
        pattern=pattern,
        amount_ref=None,
        amount_tolerance=None,
        day_min=None,
        day_max=None,
        direction_filter=transaction.direction,
        suggested_name=f"Auto: {' '.join(meaningful[:2])}",
        affected_count=affected,
    )


def _category_read(category: Category) -> CategoryRead:
    return CategoryRead(
        id=category.id,
        workspace_id=category.workspace_id,
        name=category.name,
        parent_category_id=category.parent_category_id,
        color=category.color,
        icon=category.icon,
        created_at=category.created_at,
    )


_HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _normalize_color(color: str | None) -> str | None:
    if color is None:
        return None
    value = color.strip()
    if value == "":
        return None
    if not _HEX_COLOR_RE.match(value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Color must be a hex value like #1f8a5b",
        )
    return value.lower()


def _normalize_icon(icon: str | None) -> str | None:
    if icon is None:
        return None
    value = icon.strip()
    return value or None


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
        amount_ref=rule.amount_ref,
        amount_tolerance=rule.amount_tolerance,
        day_min=rule.day_min,
        day_max=rule.day_max,
        direction_filter=rule.direction_filter,
        origin=rule.origin,
        created_at=rule.created_at,
    )


def _alias_read(alias: MerchantAlias) -> MerchantAliasRead:
    return MerchantAliasRead(
        id=alias.id,
        workspace_id=alias.workspace_id,
        pattern=alias.pattern,
        replacement=alias.replacement,
        match_type=alias.match_type,
        active=alias.active,
        created_at=alias.created_at,
    )


def _validate_alias_match_type(match_type: str) -> str:
    if match_type not in {"contains", "equals", "token"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid alias match type",
        )
    return match_type


def _normalize_alias_text(value: str, error_detail: str) -> str:
    normalized = _normalize_spaces(value)
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_detail)
    return normalized


def _get_alias(db: Session, workspace_id: str, alias_id: str) -> MerchantAlias:
    alias = db.scalar(
        select(MerchantAlias).where(
            MerchantAlias.id == alias_id,
            MerchantAlias.workspace_id == workspace_id,
        )
    )
    if alias is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Merchant alias not found"
        )
    return alias


def _ensure_unique_alias_pattern(
    db: Session,
    workspace_id: str,
    pattern: str,
    exclude_alias_id: str | None = None,
) -> None:
    query = select(MerchantAlias).where(
        MerchantAlias.workspace_id == workspace_id,
        MerchantAlias.pattern == pattern,
    )
    if exclude_alias_id is not None:
        query = query.where(MerchantAlias.id != exclude_alias_id)
    if db.scalar(query) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An alias with this pattern already exists",
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


def _normalize_rule_pattern(pattern: str, match_type: str = "contains") -> str:
    normalized = _normalize_spaces(pattern)
    if match_type == "amount_recurring":
        # Text is an optional extra filter for value-recurring rules; may be empty.
        return normalized
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rule pattern is required",
        )
    if match_type == "regex":
        import re
        try:
            re.compile(normalized)
        except re.error as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid regex pattern: {exc}",
            ) from exc
    return normalized


def _validate_rule_field(field: str) -> str:
    if field not in {"description", "raw_description", "source_name"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid rule field")
    return field


def _validate_rule_match_type(match_type: str) -> str:
    if match_type not in {"contains", "starts_with", "equals", "regex", "amount_recurring"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid rule match type",
        )
    return match_type


def _validate_rule_origin(origin: str) -> str:
    if origin not in {"manual", "ai"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid rule origin")
    return origin


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


def _preview_rule(
    db: Session,
    workspace_id: str,
    rule: CategorizationRule,
    limit: int,
) -> RulePreviewResponse:
    from app.services.categorization_service import CategorizationService

    resolved_limit = max(1, min(limit, 100))
    transactions = db.scalars(
        select(Transaction)
        .where(Transaction.workspace_id == workspace_id)
        .order_by(Transaction.transaction_date.desc(), Transaction.id)
    ).all()
    matcher = CategorizationService(db)
    matching_transactions = [
        transaction for transaction in transactions if matcher.matches(rule, transaction)
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


def _row_matches_amount_recurring(
    *,
    rule: CategorizationRule,
    amount: Decimal | None,
    transaction_date: date | None,
    direction: str | None,
    value: str | None,
    pattern: str,
) -> bool:
    """Row-level twin of CategorizationService._matches_amount_recurring for the
    optimized apply path. Compares amount magnitudes (debits are stored negative,
    users enter a positive reference), with optional day-of-month, direction and
    text (pattern) constraints."""
    if rule.amount_ref is None or amount is None:
        return False
    tolerance = rule.amount_tolerance or Decimal("0.01")
    if abs(abs(amount) - abs(rule.amount_ref)) > tolerance:
        return False
    if transaction_date is None:
        if rule.day_min is not None or rule.day_max is not None:
            return False
    else:
        if rule.day_min is not None and transaction_date.day < rule.day_min:
            return False
        if rule.day_max is not None and transaction_date.day > rule.day_max:
            return False
    if rule.direction_filter and direction != rule.direction_filter:
        return False
    if pattern and (value is None or pattern not in value):
        return False
    return True
