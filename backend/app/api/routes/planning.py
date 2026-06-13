from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import (
    AccountBalance,
    Budget,
    Category,
    FinancialCalendarEvent,
    Goal,
    Transaction,
    TransactionCategoryAssignment,
)
from app.db.session import get_db
from app.services.projection_service import ProjectionService

router = APIRouter(tags=["planning"])
DbDependency = Depends(get_db)


class CalendarEventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    event_type: str = Field(min_length=1, max_length=32)
    amount: Decimal | None = None
    due_date: date
    recurrence: str = Field(default="none", min_length=1, max_length=32)
    status: str = Field(default="planned", min_length=1, max_length=32)
    notes: str | None = Field(default=None, max_length=1000)


class CalendarEventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    event_type: str | None = Field(default=None, min_length=1, max_length=32)
    amount: Decimal | None = None
    due_date: date | None = None
    recurrence: str | None = Field(default=None, min_length=1, max_length=32)
    status: str | None = Field(default=None, min_length=1, max_length=32)
    notes: str | None = Field(default=None, max_length=1000)


class CalendarEventRead(BaseModel):
    id: str
    workspace_id: str
    title: str
    event_type: str
    amount: Decimal | None
    due_date: date
    recurrence: str
    status: str
    notes: str | None
    created_at: datetime


class CalendarEventListResponse(BaseModel):
    workspace_id: str
    items: list[CalendarEventRead]


class BudgetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    period_start: date
    period_end: date | None = None
    recurring: bool = False
    limit_amount: Decimal
    category_id: UUID | None = None
    alert_threshold: Decimal = Decimal("0.8500")
    active: bool = True


class BudgetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    period_start: date | None = None
    period_end: date | None = None
    recurring: bool | None = None
    limit_amount: Decimal | None = None
    category_id: UUID | None = None
    alert_threshold: Decimal | None = None
    active: bool | None = None


class BudgetRead(BaseModel):
    id: str
    workspace_id: str
    name: str
    category_id: str | None
    period_start: date
    period_end: date | None
    recurring: bool
    limit_amount: Decimal
    alert_threshold: Decimal
    active: bool
    created_at: datetime


class BudgetListResponse(BaseModel):
    workspace_id: str
    items: list[BudgetRead]


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    target_amount: Decimal
    description: str | None = Field(default=None, max_length=1000)
    current_amount: Decimal = Decimal("0")
    target_date: date | None = None
    tracking_mode: str = Field(default="manual", max_length=16)
    linked_account: str | None = Field(default=None, max_length=160)
    status: str = Field(default="active", min_length=1, max_length=32)
    priority: int = 100


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    target_amount: Decimal | None = None
    current_amount: Decimal | None = None
    target_date: date | None = None
    tracking_mode: str | None = Field(default=None, max_length=16)
    linked_account: str | None = Field(default=None, max_length=160)
    status: str | None = Field(default=None, min_length=1, max_length=32)
    priority: int | None = None


class GoalRead(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: str | None
    target_amount: Decimal
    current_amount: Decimal
    target_date: date | None
    tracking_mode: str
    linked_account: str | None
    status: str
    priority: int
    created_at: datetime


class GoalListResponse(BaseModel):
    workspace_id: str
    items: list[GoalRead]


class ProjectionHorizonRead(BaseModel):
    days: int
    date_to: date
    projected_income: Decimal
    projected_expenses: Decimal
    projected_balance: Decimal
    event_count: int
    risk_level: str
    risk_reason: str


class ProjectionEventRead(BaseModel):
    title: str
    event_type: str
    amount: Decimal
    due_date: date
    recurrence: str


class ProjectionGoalRead(BaseModel):
    name: str
    target_amount: Decimal
    current_amount: Decimal
    remaining_amount: Decimal
    target_date: date | None


class ProjectionResponse(BaseModel):
    workspace_id: str
    date_from: date
    horizons: list[ProjectionHorizonRead]
    upcoming_events: list[ProjectionEventRead]
    goals_due: list[ProjectionGoalRead]
    assumptions: list[str]


@router.get("/planning/projection")
async def get_projection(
    date_from: date | None = None,
    horizons: str = Query(default="30,60,90", min_length=1, max_length=32),
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> ProjectionResponse:
    reference_date = date_from or date.today()
    result = ProjectionService(db).projection(
        workspace_id=auth.workspace_id,
        date_from=reference_date,
        horizons=_parse_horizons(horizons),
    )
    return ProjectionResponse(
        workspace_id=result.workspace_id,
        date_from=result.date_from,
        horizons=[ProjectionHorizonRead(**horizon.__dict__) for horizon in result.horizons],
        upcoming_events=[ProjectionEventRead(**event.__dict__) for event in result.upcoming_events],
        goals_due=[ProjectionGoalRead(**goal) for goal in result.goals_due],
        assumptions=result.assumptions,
    )


@router.get("/calendar/events")
async def list_calendar_events(
    date_from: date | None = None,
    date_to: date | None = None,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CalendarEventListResponse:
    query = select(FinancialCalendarEvent).where(
        FinancialCalendarEvent.workspace_id == auth.workspace_id
    )
    if date_from is not None:
        query = query.where(FinancialCalendarEvent.due_date >= date_from)
    if date_to is not None:
        query = query.where(FinancialCalendarEvent.due_date <= date_to)
    events = db.scalars(
        query.order_by(FinancialCalendarEvent.due_date, FinancialCalendarEvent.title)
    ).all()
    return CalendarEventListResponse(
        workspace_id=auth.workspace_id,
        items=[_calendar_event_read(event) for event in events],
    )


@router.post("/calendar/events", status_code=status.HTTP_201_CREATED)
async def create_calendar_event(
    payload: CalendarEventCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CalendarEventRead:
    event = FinancialCalendarEvent(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        title=_normalize_required_text(payload.title, "Event title is required"),
        event_type=_validate_event_type(payload.event_type),
        amount=_validate_optional_amount(payload.amount),
        due_date=payload.due_date,
        recurrence=_validate_recurrence(payload.recurrence),
        status=_validate_event_status(payload.status),
        notes=_normalize_optional_text(payload.notes),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _calendar_event_read(event)


@router.patch("/calendar/events/{event_id}")
async def update_calendar_event(
    event_id: UUID,
    payload: CalendarEventUpdate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CalendarEventRead:
    event = _get_calendar_event(db, auth.workspace_id, str(event_id))
    if payload.title is not None:
        event.title = _normalize_required_text(payload.title, "Event title is required")
    if payload.event_type is not None:
        event.event_type = _validate_event_type(payload.event_type)
    if "amount" in payload.model_fields_set:
        event.amount = _validate_optional_amount(payload.amount)
    if payload.due_date is not None:
        event.due_date = payload.due_date
    if payload.recurrence is not None:
        event.recurrence = _validate_recurrence(payload.recurrence)
    if payload.status is not None:
        event.status = _validate_event_status(payload.status)
    if "notes" in payload.model_fields_set:
        event.notes = _normalize_optional_text(payload.notes)
    db.commit()
    db.refresh(event)
    return _calendar_event_read(event)


@router.delete("/calendar/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar_event(
    event_id: UUID,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> Response:
    event = _get_calendar_event(db, auth.workspace_id, str(event_id))
    db.delete(event)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/budgets")
async def list_budgets(
    date_from: date | None = None,
    date_to: date | None = None,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> BudgetListResponse:
    query = select(Budget).where(Budget.workspace_id == auth.workspace_id)
    period_conditions = []
    if date_from is not None:
        period_conditions.append(
            or_(Budget.period_end.is_(None), Budget.period_end >= date_from)
        )
    if date_to is not None:
        period_conditions.append(Budget.period_start <= date_to)
    if period_conditions:
        # Recurring budgets apply to every month, so they are always included.
        query = query.where(or_(and_(*period_conditions), Budget.recurring.is_(True)))
    budgets = db.scalars(
        query.order_by(Budget.recurring.desc(), Budget.period_start.desc(), Budget.name)
    ).all()
    return BudgetListResponse(
        workspace_id=auth.workspace_id,
        items=[_budget_read(budget) for budget in budgets],
    )


class BudgetRecommendationResponse(BaseModel):
    category_id: str | None
    months: int
    total: Decimal
    average: Decimal


@router.get("/budgets/recommendation")
async def budget_recommendation(
    category_id: str | None = None,
    months: int = Query(default=3, ge=1, le=12),
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> BudgetRecommendationResponse:
    """Average monthly spend for a category over the last `months` complete
    months (rolls up subcategories when a parent category is given). Used to
    suggest a budget limit."""
    if not category_id:
        return BudgetRecommendationResponse(
            category_id=None, months=months, total=Decimal("0.00"), average=Decimal("0.00")
        )

    target_ids = [category_id]
    target_ids.extend(
        db.scalars(
            select(Category.id).where(
                Category.workspace_id == auth.workspace_id,
                Category.parent_category_id == category_id,
            )
        ).all()
    )

    today = date.today()
    end_exclusive = today.replace(day=1)  # first day of current month
    year, month = end_exclusive.year, end_exclusive.month - months
    while month <= 0:
        month += 12
        year -= 1
    start = date(year, month, 1)

    total = db.scalar(
        select(func.coalesce(func.sum(func.abs(Transaction.amount)), 0))
        .select_from(Transaction)
        .join(
            TransactionCategoryAssignment,
            and_(
                TransactionCategoryAssignment.transaction_id == Transaction.id,
                TransactionCategoryAssignment.workspace_id == auth.workspace_id,
            ),
        )
        .where(
            Transaction.workspace_id == auth.workspace_id,
            Transaction.direction == "debit",
            Transaction.transaction_date >= start,
            Transaction.transaction_date < end_exclusive,
            TransactionCategoryAssignment.category_id.in_(target_ids),
        )
    ) or Decimal("0.00")
    total = Decimal(total)
    average = (total / months).quantize(Decimal("0.01"))
    return BudgetRecommendationResponse(
        category_id=category_id, months=months, total=total, average=average
    )


@router.post("/budgets", status_code=status.HTTP_201_CREATED)
async def create_budget(
    payload: BudgetCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> BudgetRead:
    category_id = str(payload.category_id) if payload.category_id is not None else None
    _ensure_category(db, auth.workspace_id, category_id)
    _validate_period(payload.period_start, payload.period_end)
    _assert_no_budget_conflict(
        db,
        auth.workspace_id,
        category_id=category_id,
        recurring=payload.recurring,
        period_start=payload.period_start,
        period_end=payload.period_end,
    )
    budget = Budget(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name=_normalize_required_text(payload.name, "Budget name is required"),
        category_id=category_id,
        period_start=payload.period_start,
        period_end=payload.period_end,
        recurring=payload.recurring,
        limit_amount=_validate_positive_amount(
            payload.limit_amount,
            "Budget limit must be positive",
        ),
        alert_threshold=_validate_alert_threshold(payload.alert_threshold),
        active=payload.active,
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return _budget_read(budget)


@router.patch("/budgets/{budget_id}")
async def update_budget(
    budget_id: UUID,
    payload: BudgetUpdate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> BudgetRead:
    budget = _get_budget(db, auth.workspace_id, str(budget_id))
    if payload.name is not None:
        budget.name = _normalize_required_text(payload.name, "Budget name is required")
    if "category_id" in payload.model_fields_set:
        category_id = str(payload.category_id) if payload.category_id is not None else None
        _ensure_category(db, auth.workspace_id, category_id)
        budget.category_id = category_id
    if payload.period_start is not None:
        budget.period_start = payload.period_start
    if "period_end" in payload.model_fields_set:
        budget.period_end = payload.period_end
    if payload.recurring is not None:
        budget.recurring = payload.recurring
    _validate_period(budget.period_start, budget.period_end)
    _assert_no_budget_conflict(
        db,
        auth.workspace_id,
        category_id=budget.category_id,
        recurring=budget.recurring,
        period_start=budget.period_start,
        period_end=budget.period_end,
        exclude_id=budget.id,
    )
    if payload.limit_amount is not None:
        budget.limit_amount = _validate_positive_amount(
            payload.limit_amount,
            "Budget limit must be positive",
        )
    if payload.alert_threshold is not None:
        budget.alert_threshold = _validate_alert_threshold(payload.alert_threshold)
    if payload.active is not None:
        budget.active = payload.active
    db.commit()
    db.refresh(budget)
    return _budget_read(budget)


@router.delete("/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: UUID,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> Response:
    budget = _get_budget(db, auth.workspace_id, str(budget_id))
    db.delete(budget)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class AccountItem(BaseModel):
    account_name: str
    balance: Decimal
    balance_date: date


class AccountListResponse(BaseModel):
    workspace_id: str
    items: list[AccountItem]


@router.get("/accounts")
async def list_accounts(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> AccountListResponse:
    """Distinct accounts with their latest imported balance (for linking goals)."""
    rows = db.execute(
        select(
            AccountBalance.account_name,
            AccountBalance.balance_amount,
            AccountBalance.balance_date,
        )
        .where(AccountBalance.workspace_id == auth.workspace_id)
        .order_by(AccountBalance.account_name, AccountBalance.balance_date.desc())
    ).all()
    latest: dict[str, AccountItem] = {}
    for name, amount, bdate in rows:
        if name not in latest:
            latest[name] = AccountItem(account_name=name, balance=amount, balance_date=bdate)
    return AccountListResponse(
        workspace_id=auth.workspace_id,
        items=sorted(latest.values(), key=lambda a: a.account_name),
    )


@router.get("/goals")
async def list_goals(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> GoalListResponse:
    goals = db.scalars(
        select(Goal)
        .where(Goal.workspace_id == auth.workspace_id)
        .order_by(Goal.priority, Goal.target_date.is_(None), Goal.target_date, Goal.name)
    ).all()
    return GoalListResponse(
        workspace_id=auth.workspace_id,
        items=[_goal_read(goal, _effective_current(db, auth.workspace_id, goal)) for goal in goals],
    )


@router.post("/goals", status_code=status.HTTP_201_CREATED)
async def create_goal(
    payload: GoalCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> GoalRead:
    goal = Goal(
        id=str(uuid4()),
        workspace_id=auth.workspace_id,
        name=_normalize_required_text(payload.name, "Goal name is required"),
        description=_normalize_optional_text(payload.description),
        target_amount=_validate_positive_amount(
            payload.target_amount,
            "Goal target must be positive",
        ),
        current_amount=_validate_non_negative_amount(payload.current_amount),
        target_date=payload.target_date,
        tracking_mode=_validate_goal_tracking(payload.tracking_mode),
        linked_account=_normalize_optional_text(payload.linked_account),
        status=_validate_goal_status(payload.status),
        priority=payload.priority,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _goal_read(goal, _effective_current(db, auth.workspace_id, goal))


@router.patch("/goals/{goal_id}")
async def update_goal(
    goal_id: UUID,
    payload: GoalUpdate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> GoalRead:
    goal = _get_goal(db, auth.workspace_id, str(goal_id))
    if payload.name is not None:
        goal.name = _normalize_required_text(payload.name, "Goal name is required")
    if "description" in payload.model_fields_set:
        goal.description = _normalize_optional_text(payload.description)
    if payload.target_amount is not None:
        goal.target_amount = _validate_positive_amount(
            payload.target_amount,
            "Goal target must be positive",
        )
    if payload.current_amount is not None:
        goal.current_amount = _validate_non_negative_amount(payload.current_amount)
    if "target_date" in payload.model_fields_set:
        goal.target_date = payload.target_date
    if payload.tracking_mode is not None:
        goal.tracking_mode = _validate_goal_tracking(payload.tracking_mode)
    if "linked_account" in payload.model_fields_set:
        goal.linked_account = _normalize_optional_text(payload.linked_account)
    if payload.status is not None:
        goal.status = _validate_goal_status(payload.status)
    if payload.priority is not None:
        goal.priority = payload.priority
    db.commit()
    db.refresh(goal)
    return _goal_read(goal, _effective_current(db, auth.workspace_id, goal))


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: UUID,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> Response:
    goal = _get_goal(db, auth.workspace_id, str(goal_id))
    db.delete(goal)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Goal contributions (transactions tagged as aportes) ---------------------

class ContributionItem(BaseModel):
    id: str
    transaction_date: date
    description: str
    amount: Decimal
    direction: str


class ContributionListResponse(BaseModel):
    goal_id: str
    items: list[ContributionItem]
    total: Decimal


def _contribution_item(tx: Transaction) -> ContributionItem:
    return ContributionItem(
        id=tx.id,
        transaction_date=tx.transaction_date,
        description=tx.description,
        amount=tx.amount,
        direction=tx.direction,
    )


@router.get("/goals/{goal_id}/contributions")
async def list_goal_contributions(
    goal_id: UUID,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> ContributionListResponse:
    goal = _get_goal(db, auth.workspace_id, str(goal_id))
    rows = db.scalars(
        select(Transaction)
        .where(Transaction.workspace_id == auth.workspace_id, Transaction.goal_id == goal.id)
        .order_by(Transaction.transaction_date.desc())
    ).all()
    total = sum((abs(tx.amount) for tx in rows), Decimal("0.00"))
    return ContributionListResponse(
        goal_id=goal.id, items=[_contribution_item(tx) for tx in rows], total=total
    )


@router.get("/goals/{goal_id}/contribution-candidates")
async def list_contribution_candidates(
    goal_id: UUID,
    q: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> ContributionListResponse:
    """Transactions not yet tagged to any goal, to pick aportes from."""
    goal = _get_goal(db, auth.workspace_id, str(goal_id))
    query = select(Transaction).where(
        Transaction.workspace_id == auth.workspace_id,
        Transaction.goal_id.is_(None),
    )
    if q:
        query = query.where(Transaction.description.ilike(f"%{q}%"))
    rows = db.scalars(query.order_by(Transaction.transaction_date.desc()).limit(limit)).all()
    return ContributionListResponse(
        goal_id=goal.id, items=[_contribution_item(tx) for tx in rows], total=Decimal("0.00")
    )


@router.post(
    "/goals/{goal_id}/contributions/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def add_goal_contribution(
    goal_id: UUID,
    transaction_id: UUID,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> Response:
    goal = _get_goal(db, auth.workspace_id, str(goal_id))
    tx = db.scalar(
        select(Transaction).where(
            Transaction.id == str(transaction_id),
            Transaction.workspace_id == auth.workspace_id,
        )
    )
    if tx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    tx.goal_id = goal.id
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/goals/{goal_id}/contributions/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_goal_contribution(
    goal_id: UUID,
    transaction_id: UUID,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> Response:
    _get_goal(db, auth.workspace_id, str(goal_id))
    tx = db.scalar(
        select(Transaction).where(
            Transaction.id == str(transaction_id),
            Transaction.workspace_id == auth.workspace_id,
            Transaction.goal_id == str(goal_id),
        )
    )
    if tx is not None:
        tx.goal_id = None
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _calendar_event_read(event: FinancialCalendarEvent) -> CalendarEventRead:
    return CalendarEventRead(
        id=event.id,
        workspace_id=event.workspace_id,
        title=event.title,
        event_type=event.event_type,
        amount=event.amount,
        due_date=event.due_date,
        recurrence=event.recurrence,
        status=event.status,
        notes=event.notes,
        created_at=event.created_at,
    )


def _budget_read(budget: Budget) -> BudgetRead:
    return BudgetRead(
        id=budget.id,
        workspace_id=budget.workspace_id,
        name=budget.name,
        category_id=budget.category_id,
        period_start=budget.period_start,
        period_end=budget.period_end,
        recurring=budget.recurring,
        limit_amount=budget.limit_amount,
        alert_threshold=budget.alert_threshold,
        active=budget.active,
        created_at=budget.created_at,
    )


def _goal_read(goal: Goal, current_override: Decimal | None = None) -> GoalRead:
    return GoalRead(
        id=goal.id,
        workspace_id=goal.workspace_id,
        name=goal.name,
        description=goal.description,
        target_amount=goal.target_amount,
        current_amount=current_override if current_override is not None else goal.current_amount,
        target_date=goal.target_date,
        tracking_mode=goal.tracking_mode,
        linked_account=goal.linked_account,
        status=goal.status,
        priority=goal.priority,
        created_at=goal.created_at,
    )


def _validate_goal_tracking(mode: str) -> str:
    if mode not in {"manual", "account", "contributions"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid tracking_mode. Use manual, account or contributions.",
        )
    return mode


def _effective_current(db: Session, workspace_id: str, goal: Goal) -> Decimal:
    """Account-tracked goals follow the latest imported balance of the linked
    account; contributions-tracked goals sum the tagged transactions; manual
    goals use the stored value."""
    if goal.tracking_mode == "account" and goal.linked_account:
        balance = db.scalar(
            select(AccountBalance.balance_amount)
            .where(
                AccountBalance.workspace_id == workspace_id,
                AccountBalance.account_name == goal.linked_account,
            )
            .order_by(AccountBalance.balance_date.desc())
            .limit(1)
        )
        if balance is not None:
            return max(balance, Decimal("0.00"))
    if goal.tracking_mode == "contributions":
        total = db.scalar(
            select(func.coalesce(func.sum(func.abs(Transaction.amount)), 0)).where(
                Transaction.workspace_id == workspace_id,
                Transaction.goal_id == goal.id,
            )
        )
        return Decimal(total or 0)
    return goal.current_amount


def _get_calendar_event(db: Session, workspace_id: str, event_id: str) -> FinancialCalendarEvent:
    event = db.scalar(
        select(FinancialCalendarEvent).where(
            FinancialCalendarEvent.id == event_id,
            FinancialCalendarEvent.workspace_id == workspace_id,
        )
    )
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar event not found",
        )
    return event


def _get_budget(db: Session, workspace_id: str, budget_id: str) -> Budget:
    budget = db.scalar(
        select(Budget).where(Budget.id == budget_id, Budget.workspace_id == workspace_id)
    )
    if budget is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    return budget


def _get_goal(db: Session, workspace_id: str, goal_id: str) -> Goal:
    goal = db.scalar(select(Goal).where(Goal.id == goal_id, Goal.workspace_id == workspace_id))
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return goal


def _ensure_category(db: Session, workspace_id: str, category_id: str | None) -> None:
    if category_id is None:
        return
    category = db.scalar(
        select(Category).where(Category.id == category_id, Category.workspace_id == workspace_id)
    )
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")


def _normalize_required_text(value: str, error_message: str) -> str:
    normalized = " ".join(value.strip().split())
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_message)
    return normalized


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.strip().split())
    return normalized or None


def _validate_event_type(event_type: str) -> str:
    if event_type not in {"income", "expense", "card_payment", "subscription", "goal", "other"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid event type")
    return event_type


def _validate_event_status(event_status: str) -> str:
    if event_status not in {"planned", "paid", "skipped"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid event status")
    return event_status


def _validate_recurrence(recurrence: str) -> str:
    if recurrence not in {"none", "monthly"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid recurrence")
    return recurrence


def _validate_goal_status(goal_status: str) -> str:
    if goal_status not in {"active", "paused", "completed"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid goal status")
    return goal_status


def _validate_optional_amount(value: Decimal | None) -> Decimal | None:
    if value is None:
        return None
    return _validate_positive_amount(value, "Amount must be positive")


def _validate_positive_amount(value: Decimal, error_message: str) -> Decimal:
    if value <= Decimal("0"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_message)
    return value


def _validate_non_negative_amount(value: Decimal) -> Decimal:
    if value < Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current amount cannot be negative",
        )
    return value


def _validate_alert_threshold(value: Decimal) -> Decimal:
    if value <= Decimal("0") or value > Decimal("1"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alert threshold must be between 0 and 1",
        )
    return value


def _validate_period(period_start: date, period_end: date | None) -> None:
    if period_end is not None and period_end < period_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Budget period end must be after start",
        )


def _budgets_overlap(
    a_recurring: bool, a_start: date, a_end: date | None,
    b_recurring: bool, b_start: date, b_end: date | None,
) -> bool:
    # A recurring budget covers every month, so it conflicts with any other
    # budget for the same category. Two specific budgets only conflict when
    # their month ranges overlap.
    if a_recurring or b_recurring:
        return True
    a_hi = a_end or a_start
    b_hi = b_end or b_start
    return a_start <= b_hi and b_start <= a_hi


def _assert_no_budget_conflict(
    db: Session,
    workspace_id: str,
    *,
    category_id: str | None,
    recurring: bool,
    period_start: date,
    period_end: date | None,
    exclude_id: str | None = None,
) -> None:
    if not category_id:
        return
    others = db.scalars(
        select(Budget).where(
            Budget.workspace_id == workspace_id,
            Budget.category_id == category_id,
        )
    ).all()
    for other in others:
        if exclude_id is not None and other.id == exclude_id:
            continue
        if _budgets_overlap(
            recurring, period_start, period_end,
            other.recurring, other.period_start, other.period_end,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe um orçamento para esta categoria neste período.",
            )


def _parse_horizons(value: str) -> list[int]:
    parts = [part.strip() for part in value.split(",") if part.strip()]
    if not parts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid horizons")
    horizons: list[int] = []
    for part in parts:
        if not part.isdigit():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid horizons")
        horizon = int(part)
        if horizon < 1 or horizon > 365:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid horizons")
        horizons.append(horizon)
    return horizons
