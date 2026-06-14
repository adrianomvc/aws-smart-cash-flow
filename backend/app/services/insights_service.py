"""Explainable, rule-based financial insights.

Composes actionable insights from the real workspace data already aggregated
by DashboardService. No LLM, no invented numbers — every insight states its
reasoning and the data it used.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Budget, Goal
from app.services.dashboard_service import DashboardService

ZERO = Decimal("0")
_MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]


def _brl(value: Decimal | float) -> str:
    n = float(value)
    s = f"{abs(n):,.0f}".replace(",", ".")
    return ("-R$ " if n < 0 else "R$ ") + s


def _month_label(ym: str) -> str:
    try:
        year, month = ym.split("-")[:2]
        return f"{_MONTHS_PT[int(month) - 1]}/{int(year) % 100:02d}"
    except (ValueError, IndexError):
        return ym


class InsightsService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.dash = DashboardService(db)

    def insights(
        self,
        workspace_id: str,
        date_from: date | None,
        date_to: date | None,
    ) -> dict[str, object]:
        summary = self.dash.summary(workspace_id, date_from, date_to)
        quality = self.dash.data_quality(workspace_id, date_from, date_to)
        items: list[dict[str, object]] = []

        income: Decimal = summary["income"]  # type: ignore[assignment]
        savings_rate = summary["savings_rate"]
        savings_target: Decimal = summary["savings_target"]  # type: ignore[assignment]
        commitment_rate = summary["commitment_rate"]
        commitment_limit: Decimal = summary["commitment_limit"]  # type: ignore[assignment]

        # 1. Saving rate vs target
        if savings_rate is not None and income > ZERO:
            sr = Decimal(savings_rate)
            gap = (sr - savings_target) * income
            sr_pct = (sr * 100).quantize(Decimal("0.1"))
            tgt_pct = (savings_target * 100).quantize(Decimal("0.1"))
            if sr >= savings_target:
                items.append({
                    "type": "pos",
                    "title": "Saving rate acima da sua meta",
                    "impact": gap.quantize(Decimal("0.01")),
                    "saving": ZERO,
                    "confidence": "Alta",
                    "reason": f"Você economizou {sr_pct}% da renda no período, "
                              f"acima da meta de {tgt_pct}% definida nas preferências.",
                    "data": "Resumo do período · preferências",
                    "action": "Direcionar para metas",
                    "action_target": "goals",
                    "action_param": None,
                })
            else:
                items.append({
                    "type": "warn",
                    "title": "Saving rate abaixo da meta",
                    "impact": gap.quantize(Decimal("0.01")),
                    "saving": ZERO,
                    "confidence": "Alta",
                    "reason": f"Você economizou {sr_pct}% da renda, abaixo da meta de "
                              f"{tgt_pct}%. Faltam {_brl(abs(gap))} no período para atingi-la.",
                    "data": "Resumo do período · preferências",
                    "action": "Revisar gastos",
                    "action_target": "cashflow",
                    "action_param": None,
                })

        # 2. Commitment of income above the configured limit
        if commitment_rate is not None and income > ZERO:
            cr = Decimal(commitment_rate)
            if cr > commitment_limit:
                over = (cr - commitment_limit) * income
                cr_pct = (cr * 100).quantize(Decimal("0.1"))
                cl_pct = (commitment_limit * 100).quantize(Decimal("0.1"))
                items.append({
                    "type": "warn",
                    "title": "Comprometimento acima do limite",
                    "impact": (-over).quantize(Decimal("0.01")),
                    "saving": ZERO,
                    "confidence": "Alta",
                    "reason": f"Suas despesas consumiram {cr_pct}% da renda, acima do limite "
                              f"de {cl_pct}%. Reduzir {_brl(over)} traria você ao limite.",
                    "data": "Resumo do período · preferências",
                    "action": "Ver orçamento",
                    "action_target": "budgets",
                    "action_param": None,
                })

        # 3. Category overspend vs the previous comparable period
        alerts = self.dash.category_growth_alerts(workspace_id, date_from, date_to, limit=2)
        for al in alerts:
            change = Decimal(al["change_amount"])  # type: ignore[arg-type]
            ratio_pct = (Decimal(al["change_ratio"]) * 100).quantize(Decimal("0.1"))  # type: ignore[arg-type]
            current = Decimal(al["current_amount"])  # type: ignore[arg-type]
            previous = Decimal(al["previous_amount"])  # type: ignore[arg-type]
            saving = (current * Decimal("0.15")).quantize(Decimal("0.01"))
            items.append({
                "type": "warn",
                "title": f"{al['category_name']} subiu {ratio_pct}%",
                "impact": (-change).quantize(Decimal("0.01")),
                "saving": saving,
                "confidence": "Média",
                "reason": f"{al['category_name']} passou de {_brl(previous)} para "
                          f"{_brl(current)} ({ratio_pct}% a mais). Reduzir 15% liberaria "
                          f"cerca de {_brl(saving)}.",
                "data": "Ranking de categorias",
                "action": "Ver transações",
                "action_target": "transactions",
                "action_param": str(al["category_id"]),
            })

        # Projection — shared by the balance-risk and surplus insights.
        try:
            proj: dict | None = self.dash.projection(workspace_id, 90)
        except Exception:  # pragma: no cover - best-effort
            proj = None

        # 4. Low projected balance risk
        if proj is not None:
            min_balance = Decimal(proj["min_balance"])  # type: ignore[arg-type]
            reserve: Decimal = summary["protected_reserve"]  # type: ignore[assignment]
            points = proj.get("points") or []
            low_month = ""
            low_val: Decimal | None = None
            for p in points:  # type: ignore[union-attr]
                pv = Decimal(p["probable"])
                if low_val is None or pv < low_val:
                    low_val = pv
                    low_month = _month_label(str(p["month"]))
            threshold = reserve if reserve > ZERO else ZERO
            if min_balance < threshold:
                negative = min_balance < ZERO
                items.append({
                    "type": "neg" if negative else "warn",
                    "title": "Saldo baixo previsto" if not negative else "Risco de saldo negativo",
                    "impact": min_balance.quantize(Decimal("0.01")),
                    "saving": ZERO,
                    "confidence": "Média",
                    "reason": (
                        f"O menor saldo previsto é {_brl(min_balance)}"
                        + (f" em {low_month}" if low_month else "")
                        + (
                            f", abaixo da sua reserva protegida de {_brl(reserve)}."
                            if reserve > ZERO
                            else ", podendo ficar negativo."
                        )
                    ),
                    "data": "Projeção 90 dias",
                    "action": "Ver compromissos",
                    "action_target": "calendar",
                    "action_param": None,
                })

        # 5. Potential savings on the largest expense category
        ranking = self.dash.category_ranking(
            workspace_id=workspace_id, date_from=date_from, date_to=date_to, limit=1
        )
        if ranking:
            top = ranking[0]
            top_amount = Decimal(top["amount"])  # type: ignore[arg-type]
            if top_amount >= Decimal("300.00") and top["category_id"] is not None:
                saving = (top_amount * Decimal("0.10")).quantize(Decimal("0.01"))
                items.append({
                    "type": "info",
                    "title": f"Oportunidade em {top['category_name']}",
                    "impact": ZERO,
                    "saving": saving,
                    "confidence": "Baixa",
                    "reason": f"{top['category_name']} é sua maior despesa do período "
                              f"({_brl(top_amount)}). Uma redução de 10% economizaria "
                              f"{_brl(saving)}.",
                    "data": "Ranking de categorias",
                    "action": "Ver transações",
                    "action_target": "transactions",
                    "action_param": str(top["category_id"]),
                })

        # 6. Data quality
        ratio = quality["categorized_ratio"]
        if ratio is not None and Decimal(ratio) < Decimal("0.95"):
            uncategorized = int(quality["uncategorized_count"])  # type: ignore[arg-type]
            if uncategorized > 0:
                q_pct = (Decimal(ratio) * 100).quantize(Decimal("0.1"))
                items.append({
                    "type": "info",
                    "title": f"{uncategorized} transações sem categoria",
                    "impact": ZERO,
                    "saving": ZERO,
                    "confidence": "Alta",
                    "reason": f"A qualidade dos dados está em {q_pct}%. Categorizar essas "
                              f"transações melhora a precisão de todos os indicadores.",
                    "data": "Qualidade dos dados",
                    "action": "Revisar",
                    "action_target": "review",
                    "action_param": None,
                })

        # 7. Emergency reserve / runway
        current_balance = summary["current_balance"]
        burn = Decimal(summary["burn_rate"]) if summary["burn_rate"] is not None else ZERO
        reserve_pref: Decimal = summary["protected_reserve"]  # type: ignore[assignment]
        if current_balance is not None and burn > ZERO:
            cb = Decimal(current_balance)  # type: ignore[arg-type]
            runway = cb / burn
            target = reserve_pref if reserve_pref > ZERO else (burn * 3)
            if cb < target:
                runway_txt = runway.quantize(Decimal("0.1"))
                ref = "sua reserva protegida" if reserve_pref > ZERO else "3 meses de despesas"
                items.append({
                    "type": "neg" if runway < 1 else "warn",
                    "title": "Reserva de emergência baixa",
                    "impact": (cb - target).quantize(Decimal("0.01")),
                    "saving": ZERO,
                    "confidence": "Média",
                    "reason": f"Seu saldo cobre cerca de {runway_txt} meses de despesas "
                              f"({_brl(burn)}/mês). O recomendado é manter ao menos "
                              f"{_brl(target)} ({ref}).",
                    "data": "Saldo atual · burn rate",
                    "action": "Planejar reserva",
                    "action_target": "planning",
                    "action_param": None,
                })

        # 8. Budgets over or near the configured limit
        budgets = list(
            self.db.scalars(
                select(Budget).where(
                    Budget.workspace_id == workspace_id, Budget.active.is_(True)
                )
            ).all()
        )
        if budgets:
            spent_by_cat = {
                r["category_id"]: Decimal(r["amount"])
                for r in self.dash.category_ranking(
                    workspace_id=workspace_id, date_from=date_from, date_to=date_to, limit=1000
                )
            }
            worst: tuple[Decimal, Budget, Decimal] | None = None
            for b in budgets:
                if b.category_id is None or b.limit_amount <= ZERO:
                    continue
                spent = spent_by_cat.get(b.category_id, ZERO)
                ratio_b = spent / b.limit_amount
                if ratio_b >= b.alert_threshold and (worst is None or ratio_b > worst[0]):
                    worst = (ratio_b, b, spent)
            if worst is not None:
                ratio_b, bud, spent = worst
                over = ratio_b >= 1
                pct_b = (ratio_b * 100).quantize(Decimal("0.1"))
                items.append({
                    "type": "neg" if over else "warn",
                    "title": f"Orçamento de {bud.name} {'estourado' if over else 'no limite'}",
                    "impact": (bud.limit_amount - spent).quantize(Decimal("0.01")),
                    "saving": ZERO,
                    "confidence": "Alta",
                    "reason": f"Você usou {_brl(spent)} de {_brl(bud.limit_amount)} "
                              f"({pct_b}%) deste orçamento no período.",
                    "data": "Orçamentos",
                    "action": "Ver orçamento",
                    "action_target": "budgets",
                    "action_param": None,
                })

        # 9. Income below the recent average
        if date_from is not None and date_to is not None and income > ZERO:
            prev_to = date_from - timedelta(days=1)
            prev_from = prev_to - timedelta(days=92)
            months = self.dash.monthly_cashflow(workspace_id, prev_from, prev_to)
            incomes = [Decimal(m["income"]) for m in months if Decimal(m["income"]) > ZERO]
            if len(incomes) >= 2:
                avg_income = sum(incomes, ZERO) / len(incomes)
                if avg_income > ZERO and income < avg_income * Decimal("0.8"):
                    drop = avg_income - income
                    items.append({
                        "type": "warn",
                        "title": "Renda abaixo da média",
                        "impact": (-drop).quantize(Decimal("0.01")),
                        "saving": ZERO,
                        "confidence": "Média",
                        "reason": f"A renda do período ({_brl(income)}) está {_brl(drop)} "
                                  f"abaixo da média dos últimos meses ({_brl(avg_income)}). "
                                  f"Vale segurar os gastos variáveis.",
                        "data": "Fluxo mensal",
                        "action": "Ver fluxo",
                        "action_target": "cashflow",
                        "action_param": None,
                    })

        # 10. Possibly forgotten subscription
        if date_to is not None:
            window_from = date_to - timedelta(days=180)
            recs = self.dash.recurring_expenses(
                workspace_id, window_from, date_to, min_months=3, limit=20
            )
            small = [
                r
                for r in recs
                if Decimal(r["average_amount"]) <= Decimal("150.00")
                and int(r["month_count"]) >= 3
            ]
            if small:
                sub = min(small, key=lambda r: Decimal(r["average_amount"]))
                amt = Decimal(sub["average_amount"])
                months_n = int(sub["month_count"])
                items.append({
                    "type": "info",
                    "title": "Possível assinatura esquecida",
                    "impact": ZERO,
                    "saving": amt.quantize(Decimal("0.01")),
                    "confidence": "Baixa",
                    "reason": f"'{sub['description']}' ({_brl(amt)}) se repete há {months_n} "
                              f"meses. Se não usa mais, cancelar economiza {_brl(amt)}/mês.",
                    "data": "Despesas recorrentes",
                    "action": "Ver recorrências",
                    "action_target": "cashflow",
                    "action_param": None,
                })

        # 11. Monthly surplus to allocate
        if proj is not None:
            net = Decimal(proj["monthly_net"])
            if net > Decimal("100.00"):
                incomplete = self.db.scalar(
                    select(func.count())
                    .select_from(Goal)
                    .where(
                        Goal.workspace_id == workspace_id,
                        Goal.status == "active",
                        Goal.current_amount < Goal.target_amount,
                    )
                )
                to_goals = (incomplete or 0) > 0
                tail = (
                    "Direcione para suas metas."
                    if to_goals
                    else "Considere investir esse valor."
                )
                items.append({
                    "type": "pos",
                    "title": "Sobra mensal para alocar",
                    "impact": net.quantize(Decimal("0.01")),
                    "saving": ZERO,
                    "confidence": "Média",
                    "reason": f"Seu fluxo deixa cerca de {_brl(net)}/mês de sobra. {tail}",
                    "data": "Projeção 90 dias",
                    "action": "Direcionar" if to_goals else "Investir",
                    "action_target": "goals" if to_goals else "investments",
                    "action_param": None,
                })

        # Order: risks first, then warnings, positives, info; by |impact| desc.
        order = {"neg": 0, "warn": 1, "pos": 2, "info": 3}
        items.sort(key=lambda it: (order.get(str(it["type"]), 9), -abs(float(it["impact"]))))

        potential_savings = sum((Decimal(it["saving"]) for it in items), ZERO)  # type: ignore[arg-type]
        risk_alerts = sum(1 for it in items if it["type"] == "neg")
        data_quality_pct = float(Decimal(ratio) * 100) if ratio is not None else None

        return {
            "workspace_id": workspace_id,
            "date_from": date_from,
            "date_to": date_to,
            "kpis": {
                "insights_count": len(items),
                "potential_savings": potential_savings.quantize(Decimal("0.01")),
                "risk_alerts": risk_alerts,
                "data_quality_pct": data_quality_pct,
            },
            "items": items,
        }
