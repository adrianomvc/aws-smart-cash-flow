"""Net worth (wealth) view.

Net worth = assets - liabilities. Assets and liabilities are maintained
manually, except the investment portfolio, which is added automatically from
the real position. The 12-month evolution is built from each item's value
snapshots (manual items without history are assumed held flat) plus the real
investment history.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import WealthItem, WealthSnapshot
from app.services.investment_service import position_summary

ZERO = Decimal("0")
_MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]


def _end_of_month(year: int, month: int) -> date:
    return date(year, month, monthrange(year, month)[1])


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    idx = year * 12 + (month - 1) + delta
    return idx // 12, (idx % 12) + 1


class _Series:
    """Sorted snapshot series for one item, with a live current value."""

    def __init__(self, current: Decimal, points: list[tuple[date, Decimal]]):
        self.current = current
        self.points = sorted(points, key=lambda p: p[0])

    def value_at(self, target: date) -> Decimal:
        if not self.points:
            return self.current
        found: Decimal | None = None
        for as_of, value in self.points:
            if as_of <= target:
                found = value
            else:
                break
        # Before the first snapshot, back-fill with the earliest known value
        # (the item existed; we just lack an older reading).
        return found if found is not None else self.points[0][1]


def wealth_summary(db: Session, workspace_id: str) -> dict:
    items = list(
        db.scalars(
            select(WealthItem).where(WealthItem.workspace_id == workspace_id)
        ).all()
    )
    manual_assets = [i for i in items if i.kind == "asset"]
    manual_liabilities = [i for i in items if i.kind == "liability"]

    item_ids = [i.id for i in items]
    snaps_by_item: dict[str, list[tuple[date, Decimal]]] = {}
    if item_ids:
        for s in db.scalars(
            select(WealthSnapshot).where(WealthSnapshot.item_id.in_(item_ids))
        ).all():
            snaps_by_item.setdefault(s.item_id, []).append((s.as_of, s.value))
    series = {i.id: _Series(i.value, snaps_by_item.get(i.id, [])) for i in items}

    inv = position_summary(db, workspace_id)
    inv_total = Decimal(inv["total"])  # type: ignore[arg-type]
    inv_history = list(inv["history"])  # type: ignore[arg-type]

    asset_rows: list[dict] = []
    if inv_total > ZERO:
        asset_rows.append({
            "id": None,
            "label": "Investimentos",
            "value": inv_total,
            "category": "investments",
            "note": "Carteira consolidada",
            "source": "auto",
            "updated_at": None,
        })
    for i in sorted(manual_assets, key=lambda x: x.value, reverse=True):
        asset_rows.append({
            "id": i.id, "label": i.label, "value": i.value,
            "category": i.category, "note": i.note, "source": "manual",
            "updated_at": i.updated_at,
        })
    liability_rows: list[dict] = [
        {
            "id": i.id, "label": i.label, "value": i.value,
            "category": i.category, "note": i.note, "source": "manual",
            "updated_at": i.updated_at,
        }
        for i in sorted(manual_liabilities, key=lambda x: x.value, reverse=True)
    ]

    total_assets = sum((Decimal(r["value"]) for r in asset_rows), ZERO)
    total_liabilities = sum((Decimal(r["value"]) for r in liability_rows), ZERO)
    net = total_assets - total_liabilities

    # ---- 12-month evolution from snapshots (aligned to the investment history) ----
    today = date.today()
    months = [_shift_month(today.year, today.month, -back) for back in range(11, -1, -1)]
    history: list[dict] = []
    for i, (yy, mm) in enumerate(months):
        anchor = _end_of_month(yy, mm)
        a_sum = sum((series[it.id].value_at(anchor) for it in manual_assets), ZERO)
        l_sum = sum((series[it.id].value_at(anchor) for it in manual_liabilities), ZERO)
        if i < len(inv_history):
            inv_v = Decimal(inv_history[i]["value"])
            label = str(inv_history[i]["label"])
        else:
            inv_v = inv_total
            label = f"{_MONTHS_PT[mm - 1]}/{yy % 100:02d}"
        history.append({"label": label, "value": a_sum - l_sum + inv_v})
    if history:
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
