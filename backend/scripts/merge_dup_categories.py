"""Merge categories that collide when ignoring accents/case (e.g. 'Salario' →
'Salário'). Repoints every reference (assignments, rules, calendar events,
budgets, sub-categories) from the loser to the accented keeper, then deletes
the loser. Idempotent. Run with --apply to commit; without it, dry-run.

Run (dry-run):  .venv/Scripts/python.exe -m scripts.merge_dup_categories
Run (commit):   .venv/Scripts/python.exe -m scripts.merge_dup_categories --apply
"""

from __future__ import annotations

import sys
from collections import defaultdict
from unicodedata import normalize as un

from sqlalchemy import select, update

from app.core.auth import LOCAL_WORKSPACE_ID
from app.db.models import (
    Budget,
    CategorizationRule,
    Category,
    FinancialCalendarEvent,
    TransactionCategoryAssignment,
)
from app.db.session import SessionLocal

WS = LOCAL_WORKSPACE_ID


def fold(s: str) -> str:
    return "".join(c for c in un("NFKD", s or "") if c.encode("ascii", "ignore") != b"").casefold().strip()


def has_accent(s: str) -> bool:
    return fold(s) != (s or "").casefold().strip()


def main() -> None:
    apply = "--apply" in sys.argv
    db = SessionLocal()
    try:
        cats = db.scalars(select(Category).where(Category.workspace_id == WS)).all()
        groups: dict[tuple[str | None, str], list[Category]] = defaultdict(list)
        for c in cats:
            # group within the same parent so we never merge across branches
            groups[(c.parent_category_id, fold(c.name))].append(c)

        pairs = [g for g in groups.values() if len({c.name for c in g}) > 1]
        if not pairs:
            print("Nenhuma categoria duplicada por acento/caixa. Nada a fazer.")
            return

        for group in pairs:
            accented = [c for c in group if has_accent(c.name)]
            plain = [c for c in group if not has_accent(c.name)]
            if len(accented) != 1 or not plain:
                print(f"  ! ambíguo, pulando: {[c.name for c in group]}")
                continue
            keeper = accented[0]
            for loser in plain:
                count = len(db.scalars(select(TransactionCategoryAssignment.id).where(TransactionCategoryAssignment.category_id == loser.id)).all())
                n_rules = len(db.scalars(select(CategorizationRule.id).where(CategorizationRule.category_id == loser.id)).all())
                n_cal = len(db.scalars(select(FinancialCalendarEvent.id).where(FinancialCalendarEvent.category_id == loser.id)).all())
                n_bud = len(db.scalars(select(Budget.id).where(Budget.category_id == loser.id)).all())
                n_child = len(db.scalars(select(Category.id).where(Category.parent_category_id == loser.id)).all())
                print(f"  '{loser.name}' -> '{keeper.name}'  "
                      f"(transações={count}, regras={n_rules}, calendário={n_cal}, orçamentos={n_bud}, subcats={n_child})")
                if apply:
                    db.execute(update(TransactionCategoryAssignment).where(TransactionCategoryAssignment.category_id == loser.id).values(category_id=keeper.id))
                    db.execute(update(CategorizationRule).where(CategorizationRule.category_id == loser.id).values(category_id=keeper.id))
                    db.execute(update(FinancialCalendarEvent).where(FinancialCalendarEvent.category_id == loser.id).values(category_id=keeper.id))
                    db.execute(update(Budget).where(Budget.category_id == loser.id).values(category_id=keeper.id))
                    db.execute(update(Category).where(Category.parent_category_id == loser.id).values(parent_category_id=keeper.id))
                    db.delete(loser)

        if apply:
            db.commit()
            print("\nAPLICADO e commitado.")
        else:
            print("\nDRY-RUN (nada alterado). Rode com --apply para efetivar.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
