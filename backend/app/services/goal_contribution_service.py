"""Auto-link transactions to goals based on each goal's aporte rule.

A goal in "contributions" mode may define a rule: a description fragment and an
optional value range. Matching, not-yet-tagged transactions are linked to the
goal (their ``goal_id`` is set). Used both retroactively (when a rule changes)
and after every import.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Goal, Transaction


def apply_goal_aporte_rule(db: Session, workspace_id: str, goal: Goal) -> int:
    """Link untagged transactions matching the goal's rule. Returns the count."""
    if goal.tracking_mode != "contributions" or not goal.aporte_match_text:
        return 0
    text = goal.aporte_match_text.strip()
    if not text:
        return 0

    conditions = [
        Transaction.workspace_id == workspace_id,
        Transaction.goal_id.is_(None),
        Transaction.description.ilike(f"%{text}%"),
    ]
    if goal.aporte_min is not None:
        conditions.append(func.abs(Transaction.amount) >= goal.aporte_min)
    if goal.aporte_max is not None:
        conditions.append(func.abs(Transaction.amount) <= goal.aporte_max)

    rows = db.scalars(select(Transaction).where(*conditions)).all()
    for tx in rows:
        tx.goal_id = goal.id
    return len(rows)


def apply_goal_aporte_rules(db: Session, workspace_id: str) -> int:
    """Apply the aporte rule of every contributions goal in the workspace."""
    goals = db.scalars(
        select(Goal).where(
            Goal.workspace_id == workspace_id,
            Goal.tracking_mode == "contributions",
            Goal.aporte_match_text.is_not(None),
        )
    ).all()
    return sum(apply_goal_aporte_rule(db, workspace_id, goal) for goal in goals)
