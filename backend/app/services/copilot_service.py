"""Financial copilot — answers questions about the user's real finances by
feeding a compact snapshot (from DashboardService) into the LLM."""
from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.services.dashboard_service import DashboardService
from app.services.llm_client import chat, llm_available

_SYSTEM = (
    "Você é o Copiloto Financeiro do SmartCashFlow, um assistente brasileiro de "
    "finanças pessoais. Responda em português, de forma clara, curta e prática, "
    "usando R$ e os DADOS abaixo. Baseie-se SOMENTE nesses dados — não invente "
    "números. Se a informação não estiver nos dados, diga que não tem esse dado "
    "ainda e sugira onde olhar no app. Quando fizer sentido, dê uma recomendação "
    "acionável. Não dê conselhos de investimento específicos nem garantias."
)


def _brl(value: object) -> str:
    try:
        n = float(value or 0)
    except (TypeError, ValueError):
        return "R$ 0"
    return "R$ " + f"{n:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")


def _pct(value: object) -> str:
    try:
        return f"{float(value) * 100:.0f}%"
    except (TypeError, ValueError):
        return "—"


class CopilotService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.dash = DashboardService(db)

    def available(self) -> bool:
        return llm_available()

    def answer(
        self,
        workspace_id: str,
        message: str,
        history: list[dict] | None,
        date_from: date | None,
        date_to: date | None,
    ) -> dict[str, object]:
        if not llm_available():
            return {"reply": None, "available": False}
        context = self._context(workspace_id, date_from, date_to)
        messages: list[dict] = [{"role": "system", "content": f"{_SYSTEM}\n\n{context}"}]
        for turn in (history or [])[-6:]:
            role = "assistant" if turn.get("role") == "assistant" else "user"
            content = str(turn.get("content", ""))[:2000]
            if content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": message[:2000]})
        reply = chat(messages, temperature=0.4, max_tokens=700)
        return {"reply": reply, "available": True}

    def _context(self, workspace_id: str, date_from: date | None, date_to: date | None) -> str:
        period = (
            f"{date_from.isoformat()} a {date_to.isoformat()}"
            if date_from and date_to
            else "todo o histórico"
        )
        s = self.dash.summary(workspace_id, date_from, date_to)
        cats = self.dash.category_ranking(workspace_id, date_from, date_to, limit=10)
        breakdown = self.dash.spending_breakdown(workspace_id, date_from, date_to)
        recurring = self.dash.recurring_expenses(
            workspace_id, date_from, date_to, min_months=2, limit=8
        )

        lines: list[str] = ["DADOS DO USUÁRIO:", f"Período: {period}"]
        lines.append(
            f"Receitas: {_brl(s.get('income'))} | Despesas: {_brl(s.get('expenses'))} | "
            f"Saldo do período: {_brl(s.get('balance'))}"
        )
        if s.get("current_balance") is not None:
            lines.append(f"Saldo em conta: {_brl(s.get('current_balance'))}")
        lines.append(
            f"Taxa de poupança: {_pct(s.get('savings_rate'))} | "
            f"Comprometimento: {_pct(s.get('commitment_rate'))} | "
            f"Gasto médio/mês (burn rate): {_brl(s.get('burn_rate'))}"
        )
        if s.get("safe_spend") is not None:
            lines.append(f"Gasto seguro nos próximos 30 dias: {_brl(s.get('safe_spend'))}")
        if s.get("financial_health_score") is not None:
            lines.append(f"Saúde financeira (0-100): {s.get('financial_health_score')}")

        fixed = breakdown.get("fixed", {}) or {}
        variable = breakdown.get("variable", {}) or {}
        lines.append(
            f"Custos fixos: {_brl(fixed.get('total'))} ({fixed.get('count', 0)} lanç.) | "
            f"Variáveis: {_brl(variable.get('total'))} ({variable.get('count', 0)} lanç.)"
        )
        size_parts = [
            f"{b['key']} {b['label']} ({b['helper']}): {_brl(b['total'])} em {b['count']} lanç."
            for b in breakdown.get("size_buckets", [])
        ]
        if size_parts:
            lines.append("Porte das despesas — " + "; ".join(size_parts))

        if cats:
            lines.append("Maiores categorias de gasto:")
            for c in cats[:10]:
                lines.append(
                    f"  - {c.get('category_name')}: {_brl(c.get('amount'))} "
                    f"({_pct(c.get('share_ratio'))}, {c.get('count')} lanç.)"
                )
        if recurring:
            lines.append("Despesas recorrentes (fixas prováveis):")
            for r in recurring[:8]:
                lines.append(
                    f"  - {r.get('description')} ({r.get('category_name') or 'sem categoria'}): "
                    f"~{_brl(r.get('average_amount'))}/mês"
                )
        return "\n".join(lines)
