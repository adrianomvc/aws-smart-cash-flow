from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.models import FinancialCalendarEvent, Goal

ZERO = Decimal("0.00")


@dataclass(frozen=True)
class ProjectionEvent:
    title: str
    event_type: str
    amount: Decimal
    due_date: date
    recurrence: str = "none"


@dataclass(frozen=True)
class ProjectionHorizon:
    days: int
    date_to: date
    projected_income: Decimal
    projected_expenses: Decimal
    projected_balance: Decimal
    event_count: int
    risk_level: str
    risk_reason: str


@dataclass(frozen=True)
class ProjectionResult:
    workspace_id: str
    date_from: date
    horizons: list[ProjectionHorizon]
    upcoming_events: list[ProjectionEvent]
    goals_due: list[dict[str, object]]
    assumptions: list[str]


class ProjectionService:
    def __init__(self, db: Session):
        self.db = db

    def projection(
        self,
        *,
        workspace_id: str,
        date_from: date,
        horizons: list[int],
    ) -> ProjectionResult:
        normalized_horizons = normalize_horizons(horizons)
        max_days = max(normalized_horizons)
        events = self._events(workspace_id=workspace_id, date_from=date_from, max_days=max_days)
        projected = build_projection(
            date_from=date_from,
            events=events,
            horizons=normalized_horizons,
        )
        goals_due = self._goals_due(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=projected[-1].date_to,
        )
        return ProjectionResult(
            workspace_id=workspace_id,
            date_from=date_from,
            horizons=projected,
            upcoming_events=events[:8],
            goals_due=goals_due,
            assumptions=[
                "A projecao usa eventos financeiros planejados no calendario.",
                "Eventos mensais sao repetidos dentro do horizonte selecionado.",
                "Transacoes historicas aparecem como contexto nas telas de fluxo e dashboard.",
                "Saldo bancario real ainda nao esta integrado; o saldo projetado e operacional.",
                "IA e simulador completo ficam fora deste primeiro recorte.",
            ],
        )

    def _events(
        self,
        *,
        workspace_id: str,
        date_from: date,
        max_days: int,
    ) -> list[ProjectionEvent]:
        date_to = date_from.fromordinal(date_from.toordinal() + max_days)
        rows = self.db.scalars(
            select(FinancialCalendarEvent)
            .where(
                FinancialCalendarEvent.workspace_id == workspace_id,
                FinancialCalendarEvent.status == "planned",
                FinancialCalendarEvent.amount.is_not(None),
                or_(
                    FinancialCalendarEvent.due_date >= date_from,
                    FinancialCalendarEvent.recurrence == "monthly",
                ),
                FinancialCalendarEvent.due_date <= date_to,
            )
            .order_by(FinancialCalendarEvent.due_date, FinancialCalendarEvent.title)
        ).all()
        return [
            ProjectionEvent(
                title=row.title,
                event_type=row.event_type,
                amount=Decimal(row.amount or ZERO),
                due_date=row.due_date,
                recurrence=row.recurrence,
            )
            for row in rows
            if row.amount is not None and row.amount > ZERO
        ]

    def _goals_due(
        self,
        *,
        workspace_id: str,
        date_from: date,
        date_to: date,
    ) -> list[dict[str, object]]:
        goals = self.db.scalars(
            select(Goal)
            .where(
                Goal.workspace_id == workspace_id,
                Goal.status == "active",
                Goal.target_date.is_not(None),
                Goal.target_date >= date_from,
                Goal.target_date <= date_to,
            )
            .order_by(Goal.target_date, Goal.priority, Goal.name)
        ).all()
        return [
            {
                "name": goal.name,
                "target_amount": goal.target_amount,
                "current_amount": goal.current_amount,
                "target_date": goal.target_date,
                "remaining_amount": max(goal.target_amount - goal.current_amount, ZERO),
            }
            for goal in goals[:8]
        ]


def normalize_horizons(horizons: list[int]) -> list[int]:
    normalized = sorted({value for value in horizons if 1 <= value <= 365})
    if not normalized:
        return [30, 60, 90]
    return normalized[:6]


def build_projection(
    *,
    date_from: date,
    events: list[ProjectionEvent],
    horizons: list[int],
) -> list[ProjectionHorizon]:
    projected: list[ProjectionHorizon] = []
    for days in normalize_horizons(horizons):
        date_to = date_from.fromordinal(date_from.toordinal() + days)
        occurrences = projected_occurrences(events=events, date_from=date_from, date_to=date_to)
        income = sum(
            (event.amount for event in occurrences if event.event_type == "income"),
            ZERO,
        )
        expenses = sum(
            (event.amount for event in occurrences if event.event_type != "income"),
            ZERO,
        )
        balance = (income - expenses).quantize(Decimal("0.01"))
        risk_level, risk_reason = classify_projection_risk(balance=balance, expenses=expenses)
        projected.append(
            ProjectionHorizon(
                days=days,
                date_to=date_to,
                projected_income=income.quantize(Decimal("0.01")),
                projected_expenses=expenses.quantize(Decimal("0.01")),
                projected_balance=balance,
                event_count=len(occurrences),
                risk_level=risk_level,
                risk_reason=risk_reason,
            )
        )
    return projected


def projected_occurrences(
    *,
    events: list[ProjectionEvent],
    date_from: date,
    date_to: date,
) -> list[ProjectionEvent]:
    occurrences: list[ProjectionEvent] = []
    for event in events:
        if event.recurrence != "monthly":
            if date_from <= event.due_date <= date_to:
                occurrences.append(event)
            continue
        current = event.due_date
        while current < date_from:
            current = add_month(current)
        while current <= date_to:
            occurrences.append(
                ProjectionEvent(
                    title=event.title,
                    event_type=event.event_type,
                    amount=event.amount,
                    due_date=current,
                    recurrence=event.recurrence,
                )
            )
            current = add_month(current)
    return sorted(occurrences, key=lambda item: (item.due_date, item.title))


def add_month(value: date) -> date:
    year = value.year + (1 if value.month == 12 else 0)
    month = 1 if value.month == 12 else value.month + 1
    day = min(value.day, month_last_day(year, month))
    return date(year, month, day)


def month_last_day(year: int, month: int) -> int:
    if month == 12:
        return 31
    return date(year, month + 1, 1).toordinal() - date(year, month, 1).toordinal()


def classify_projection_risk(*, balance: Decimal, expenses: Decimal) -> tuple[str, str]:
    if balance < ZERO:
        return "risk", "Saidas previstas superam entradas previstas."
    if expenses > ZERO and balance <= expenses * Decimal("0.10"):
        return "attention", "Folga projetada menor ou igual a 10% das saidas."
    return "healthy", "Folga projetada positiva no horizonte."
