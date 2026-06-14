"""Net worth (wealth) view.

Net worth = assets - liabilities. Assets and liabilities are maintained
manually, except the investment portfolio, which is added automatically from
the real position. The 12-month evolution reuses the investment history
(manual items are assumed held flat over the window).
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import WealthItem
from app.services.investment_service import position_summary

ZERO = Decimal("0")


def wealth_summary(db: Session, workspace_id: str) -> dict:
    items = list(
        db.scalars(
            select(WealthItem).where(WealthItem.workspace_id == workspace_id)
        ).all()
    )
    manual_assets = [i for i in items if i.kind == "asset"]
    manual_liabilities = [i for i in items if i.kind == "liability"]

    inv = position_summary(db, workspace_id)
    inv_total = Decimal(inv["total"])  # type: ignore[arg-type]
    inv_history = inv["history"]  # type: ignore[assignment]

    asset_rows: list[dict] = []
    if inv_total > ZERO:
        asset_rows.append({
            "id": None,
            "label": "Investimentos",
            "value": inv_total,
            "category": "investments",
            "note": "Carteira consolidada",
            "source": "auto",
        })
    for i in sorted(manual_assets, key=lambda x: x.value, reverse=True):
        asset_rows.append({
            "id": i.id,
            "label": i.label,
            "value": i.value,
            "category": i.category,
            "note": i.note,
            "source": "manual",
        })

    liability_rows: list[dict] = [
        {
            "id": i.id,
            "label": i.label,
            "value": i.value,
            "category": i.category,
            "note": i.note,
            "source": "manual",
        }
        for i in sorted(manual_liabilities, key=lambda x: x.value, reverse=True)
    ]

    total_assets = sum((Decimal(r["value"]) for r in asset_rows), ZERO)
    total_liabilities = sum((Decimal(r["value"]) for r in liability_rows), ZERO)
    net = total_assets - total_liabilities

    manual_assets_total = sum((i.value for i in manual_assets), ZERO)
    manual_liabilities_total = sum((i.value for i in manual_liabilities), ZERO)
    manual_net = manual_assets_total - manual_liabilities_total

    history: list[dict] = []
    for h in inv_history:  # type: ignore[union-attr]
        history.append({"label": h["label"], "value": manual_net + Decimal(h["value"])})
    if history:
        # Keep the latest point exactly equal to the current net worth.
        history[-1]["value"] = net

    delta = ZERO
    delta_pct = 0.0
    if len(history) >= 2:
        prev = history[-2]["value"]
        delta = net - prev
        if prev != ZERO:
            delta_pct = float(delta / abs(prev) * 100)

    return {
        "workspace_id": workspace_id,
        "net_worth": net,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "delta": delta,
        "delta_pct": delta_pct,
        "assets": asset_rows,
        "liabilities": liability_rows,
        "history": history,
    }
