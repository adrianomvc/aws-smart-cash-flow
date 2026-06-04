from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Budget, FinancialCalendarEvent, Goal
from app.services.dashboard_service import DashboardService


@dataclass(frozen=True)
class ReportCard:
    id: str
    title: str
    description: str
    status: str
    primary_metric: str
    secondary_metric: str
    target_page: str


class ReportService:
    def __init__(self, db: Session):
        self.db = db
        self.dashboard = DashboardService(db)

    def reports(
        self,
        *,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> list[ReportCard]:
        summary = self.dashboard.summary(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        quality = self.dashboard.data_quality(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        category_ranking = self.dashboard.category_ranking(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
            limit=5,
        )
        budget_count = self._budget_count(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )
        goal_count = self._goal_count(workspace_id=workspace_id)
        event_count = self._event_count(
            workspace_id=workspace_id,
            date_from=date_from,
            date_to=date_to,
        )

        return normalize_report_cards(
            [
                ReportCard(
                    id="executive-summary",
                    title="Resumo executivo",
                    description="Receitas, despesas, saldo e indicadores principais do periodo.",
                    status=_status_by_count(summary["transaction_count"]),
                    primary_metric=_money(summary["balance"]),
                    secondary_metric=f"{summary['transaction_count']} transacoes",
                    target_page="dashboard",
                ),
                ReportCard(
                    id="cashflow",
                    title="Fluxo de caixa",
                    description="Evolucao de entradas, saidas e saldo por periodo.",
                    status=_status_by_count(summary["transaction_count"]),
                    primary_metric=_money(summary["income"] - summary["expenses"]),
                    secondary_metric=f"Burn rate {_money(summary['burn_rate'])}",
                    target_page="cashflow",
                ),
                ReportCard(
                    id="income",
                    title="Receitas",
                    description="Leitura consolidada de entradas no periodo.",
                    status=_status_by_amount(summary["income"]),
                    primary_metric=_money(summary["income"]),
                    secondary_metric="Entradas confirmadas",
                    target_page="transactions",
                ),
                ReportCard(
                    id="expenses",
                    title="Despesas",
                    description="Categorias e lancamentos que mais impactam o periodo.",
                    status=_status_by_amount(summary["expenses"]),
                    primary_metric=_money(summary["expenses"]),
                    secondary_metric=f"{len(category_ranking)} categorias no ranking",
                    target_page="transactions",
                ),
                ReportCard(
                    id="cards",
                    title="Cartoes",
                    description="Faturas, pagamentos e compras parceladas disponiveis.",
                    status="partial",
                    primary_metric=_money(summary["payments"]),
                    secondary_metric="Consolidacao inicial",
                    target_page="cards",
                ),
                ReportCard(
                    id="budgets",
                    title="Orcamentos",
                    description="Limites cadastrados e acompanhamento do mes.",
                    status=_status_by_count(budget_count),
                    primary_metric=str(budget_count),
                    secondary_metric="orcamentos ativos",
                    target_page="budgets",
                ),
                ReportCard(
                    id="goals",
                    title="Metas",
                    description="Objetivos financeiros e progresso cadastrado.",
                    status=_status_by_count(goal_count),
                    primary_metric=str(goal_count),
                    secondary_metric="metas ativas",
                    target_page="goals",
                ),
                ReportCard(
                    id="data-quality",
                    title="Qualidade dos dados",
                    description="Cobertura de categorizacao, erros e duplicidades.",
                    status=_status_by_count(quality["transaction_count"]),
                    primary_metric=_percent(quality["categorized_ratio"]),
                    secondary_metric=f"{quality['uncategorized_count']} pendentes",
                    target_page="review",
                ),
                ReportCard(
                    id="planning-events",
                    title="Calendario e planejamento",
                    description="Eventos futuros que sustentam a leitura de planejamento.",
                    status=_status_by_count(event_count),
                    primary_metric=str(event_count),
                    secondary_metric="eventos planejados",
                    target_page="planning",
                ),
            ]
        )

    def _budget_count(
        self,
        *,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> int:
        query = select(func.count()).select_from(Budget).where(Budget.workspace_id == workspace_id)
        if date_from is not None:
            query = query.where(Budget.period_end >= date_from)
        if date_to is not None:
            query = query.where(Budget.period_start <= date_to)
        return int(self.db.scalar(query) or 0)

    def _goal_count(self, *, workspace_id: str) -> int:
        return int(
            self.db.scalar(
                select(func.count()).select_from(Goal).where(
                    Goal.workspace_id == workspace_id,
                    Goal.status == "active",
                )
            )
            or 0
        )

    def _event_count(
        self,
        *,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> int:
        query = (
            select(func.count())
            .select_from(FinancialCalendarEvent)
            .where(FinancialCalendarEvent.workspace_id == workspace_id)
        )
        if date_from is not None:
            query = query.where(FinancialCalendarEvent.due_date >= date_from)
        if date_to is not None:
            query = query.where(FinancialCalendarEvent.due_date <= date_to)
        return int(self.db.scalar(query) or 0)


def normalize_report_cards(cards: list[ReportCard]) -> list[ReportCard]:
    return sorted(cards, key=lambda card: card.id)


def _status_by_count(count: int) -> str:
    return "ready" if count > 0 else "empty"


def _status_by_amount(amount: Decimal) -> str:
    return "ready" if amount > Decimal("0") else "empty"


def _money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))


def _percent(value: Decimal | None) -> str:
    if value is None:
        return "0.00%"
    return f"{(value * Decimal('100')).quantize(Decimal('0.01'))}%"
