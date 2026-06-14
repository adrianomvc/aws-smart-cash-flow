"""Investment position view.

Computes the consolidated portfolio position from manually maintained
custodies and assets, deriving returns and the 12-month evolution from the
value snapshots recorded over time (no market price feed).
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import InvestmentAsset, InvestmentCustody, InvestmentSnapshot

# Fixed asset-class reference (label + color), mirrored on the frontend.
ASSET_CLASSES: list[dict[str, str]] = [
    {"id": "rf", "label": "Renda Fixa", "color": "#3567b8"},
    {"id": "prev", "label": "Previdência", "color": "#7c3aed"},
    {"id": "rv", "label": "Ações & ETFs", "color": "#1f8a5b"},
    {"id": "fii", "label": "Fundos Imob.", "color": "#6a52c9"},
    {"id": "crypto", "label": "Cripto", "color": "#c98a2b"},
    {"id": "other", "label": "Outros", "color": "#8a8f99"},
]
ASSET_CLASS_IDS = {c["id"] for c in ASSET_CLASSES}
_CLASS_META = {c["id"]: c for c in ASSET_CLASSES}

ACCOUNT_TYPES = {"broker", "pension", "cex", "wallet", "reserve", "bank"}

_MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]


def class_meta(class_id: str) -> dict[str, str]:
    return _CLASS_META.get(class_id, _CLASS_META["other"])


def _end_of_month(year: int, month: int) -> date:
    return date(year, month, monthrange(year, month)[1])


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    idx = year * 12 + (month - 1) + delta
    return idx // 12, (idx % 12) + 1


def _pct(now: Decimal, prev: Decimal) -> float:
    if prev <= 0:
        return 0.0
    return float((now - prev) / prev * 100)


class _Series:
    """Sorted snapshot value series for one asset, with a live current value."""

    def __init__(self, current: Decimal, points: list[tuple[date, Decimal]]):
        self.current = current
        self.points = sorted(points, key=lambda p: p[0])

    def value_at(self, target: date) -> Decimal | None:
        found: Decimal | None = None
        for as_of, value in self.points:
            if as_of <= target:
                found = value
            else:
                break
        return found

    @property
    def has_history(self) -> bool:
        return bool(self.points)


def position_summary(
    db: Session, workspace_id: str, as_of: date | None = None
) -> dict:
    custodies = list(
        db.scalars(
            select(InvestmentCustody)
            .where(
                InvestmentCustody.workspace_id == workspace_id,
                InvestmentCustody.active.is_(True),
            )
            .order_by(InvestmentCustody.name)
        ).all()
    )
    assets = list(
        db.scalars(
            select(InvestmentAsset)
            .where(
                InvestmentAsset.workspace_id == workspace_id,
                InvestmentAsset.active.is_(True),
            )
            .order_by(InvestmentAsset.name)
        ).all()
    )
    asset_ids = [a.id for a in assets]
    snaps_by_asset: dict[str, list[tuple[date, Decimal]]] = {}
    if asset_ids:
        for snap in db.scalars(
            select(InvestmentSnapshot).where(InvestmentSnapshot.asset_id.in_(asset_ids))
        ).all():
            snaps_by_asset.setdefault(snap.asset_id, []).append((snap.as_of, snap.value))

    has_snapshots = any(snaps_by_asset.values())
    series: dict[str, _Series] = {
        a.id: _Series(a.current_value, snaps_by_asset.get(a.id, [])) for a in assets
    }
    custody_by_id = {c.id: c for c in custodies}

    today = date.today()
    # ref_date is "now" for the position; when a past month is selected the
    # position is reconstructed as of that date from the value snapshots.
    ref_date = as_of or today
    month_ago = ref_date - timedelta(days=30)
    year_ago = ref_date - timedelta(days=365)
    ytd_start = date(ref_date.year, 1, 1)

    def ev(a: InvestmentAsset) -> Decimal:
        """Effective value of a position as of ref_date."""
        s = series[a.id]
        if ref_date >= today:
            return a.current_value
        at = s.value_at(ref_date)
        if at is not None:
            return at
        # No snapshot up to ref_date: assume held flat if the asset has no
        # history at all, otherwise it had no recorded value yet.
        return a.current_value if not s.has_history else Decimal("0")

    total = sum((ev(a) for a in assets), Decimal("0"))
    total_contrib = sum((a.contributed for a in assets), Decimal("0"))
    total_gain = total - total_contrib

    def group_return(group: list[InvestmentAsset], ref: date) -> float:
        prev_sum = Decimal("0")
        now_sum = Decimal("0")
        for a in group:
            prev = series[a.id].value_at(ref)
            if prev is not None and prev > 0:
                prev_sum += prev
                now_sum += ev(a)
        return _pct(now_sum, prev_sum)

    month_return = group_return(assets, month_ago)
    year_return = group_return(assets, year_ago)
    ytd_return = group_return(assets, ytd_start)

    # ---- Allocation / performance by class ----
    by_class: dict[str, list[InvestmentAsset]] = {}
    for a in assets:
        by_class.setdefault(a.asset_class, []).append(a)
    classes: list[dict] = []
    for class_id, group in by_class.items():
        value = sum((ev(a) for a in group), Decimal("0"))
        if value <= 0:
            continue
        meta = class_meta(class_id)
        classes.append(
            {
                "id": class_id,
                "label": meta["label"],
                "color": meta["color"],
                "value": value,
                "pct": float(value / total * 100) if total > 0 else 0.0,
                "contributed": sum((a.contributed for a in group), Decimal("0")),
                "month_return": group_return(group, month_ago),
                "year_return": group_return(group, year_ago),
            }
        )
    classes.sort(key=lambda c: c["value"], reverse=True)

    # ---- Custodies ----
    assets_by_custody: dict[str, list[InvestmentAsset]] = {}
    for a in assets:
        assets_by_custody.setdefault(a.custody_id, []).append(a)
    accounts: list[dict] = []
    for c in custodies:
        group = assets_by_custody.get(c.id, [])
        value = sum((ev(a) for a in group), Decimal("0"))
        prev = Decimal("0")
        for a in group:
            at = series[a.id].value_at(month_ago)
            prev += at if at is not None else ev(a)
        contrib = sum((a.contributed for a in group), Decimal("0"))
        cls_breakdown: dict[str, Decimal] = {}
        for a in group:
            cls_breakdown[a.asset_class] = (
                cls_breakdown.get(a.asset_class, Decimal("0")) + ev(a)
            )
        cls_sorted = sorted(cls_breakdown.items(), key=lambda kv: kv[1], reverse=True)
        accounts.append(
            {
                "id": c.id,
                "name": c.name,
                "kind": c.kind,
                "account_type": c.account_type,
                "brand": c.brand,
                "color": c.color,
                "value": value,
                "prev": prev,
                "contrib": contrib,
                "classes": [{"id": cid, "value": cval} for cid, cval in cls_sorted],
                "sync_mode": c.sync_mode,
                "updated_at": c.updated_at,
            }
        )
    accounts.sort(key=lambda a: a["value"], reverse=True)

    # ---- Detailed positions ----
    asset_rows: list[dict] = []
    for a in assets:
        s = series[a.id]
        value = ev(a)
        prev_m = s.value_at(month_ago)
        prev_y = s.value_at(ytd_start)
        custody = custody_by_id.get(a.custody_id)
        asset_rows.append(
            {
                "id": a.id,
                "name": a.name,
                "asset_class": a.asset_class,
                "custody_id": a.custody_id,
                "account": custody.name if custody is not None else "",
                "value": value,
                "contributed": a.contributed,
                "risk": a.risk,
                "detail": a.detail,
                "month_return": _pct(value, prev_m) if prev_m is not None else 0.0,
                "ytd_return": _pct(value, prev_y) if prev_y is not None else 0.0,
                "updated_at": a.updated_at,
            }
        )
    asset_rows.sort(key=lambda r: r["value"], reverse=True)

    # ---- 12-month evolution ----
    history: list[dict] = []
    months: list[tuple[int, int]] = []
    for back in range(11, -1, -1):
        months.append(_shift_month(ref_date.year, ref_date.month, -back))
    for i, (yy, mm) in enumerate(months):
        is_current = i == len(months) - 1
        if is_current:
            point_value = total
        else:
            anchor = _end_of_month(yy, mm)
            point_value = Decimal("0")
            for a in assets:
                s = series[a.id]
                if s.has_history:
                    at = s.value_at(anchor)
                    if at is not None:
                        point_value += at
                else:
                    # No snapshots: assume the position was held flat.
                    point_value += a.current_value
        history.append({"label": f"{_MONTHS_PT[mm - 1]}/{yy % 100:02d}", "value": point_value})

    return {
        "workspace_id": workspace_id,
        "total": total,
        "total_contributed": total_contrib,
        "total_gain": total_gain,
        "month_return": month_return,
        "year_return": year_return,
        "ytd_return": ytd_return,
        "custody_count": len(custodies),
        "asset_count": len(assets),
        "has_snapshots": has_snapshots,
        "classes": classes,
        "accounts": accounts,
        "assets": asset_rows,
        "history": history,
    }
