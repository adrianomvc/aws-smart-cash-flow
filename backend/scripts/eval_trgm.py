"""Sampled probe of the pg_trgm 'memory' layer: of the transactions currently
WITHOUT a category, how many would trigram similarity (threshold 0.45) resolve
by matching an already-categorized transaction? Read-only.

Run: .venv/Scripts/python.exe -m scripts.eval_trgm [sample_size]
"""

from __future__ import annotations

import sys

from sqlalchemy import select, text

from app.core.auth import LOCAL_WORKSPACE_ID
from app.db.models import Transaction, TransactionCategoryAssignment
from app.db.session import SessionLocal

WS = LOCAL_WORKSPACE_ID
THRESHOLD = 0.45


def main() -> None:
    sample_size = int(sys.argv[1]) if len(sys.argv) > 1 else 250
    db = SessionLocal()
    try:
        categorized_ids = {
            a.transaction_id
            for a in db.scalars(
                select(TransactionCategoryAssignment).where(
                    TransactionCategoryAssignment.workspace_id == WS,
                    TransactionCategoryAssignment.category_id.is_not(None),
                )
            ).all()
        }
        uncategorized = [
            tx for tx in db.scalars(select(Transaction).where(Transaction.workspace_id == WS)).all()
            if tx.id not in categorized_ids and (tx.description or "").strip()
        ]
        n_uncat = len(uncategorized)
        sample = uncategorized[:sample_size]

        hits = 0
        examples: list[tuple[str, str, float]] = []
        for tx in sample:
            row = db.execute(
                text(
                    """
                    SELECT a.category_id, t.description AS match_desc,
                           similarity(t.description, :desc) AS sim
                    FROM transactions t
                    JOIN transaction_category_assignments a
                      ON a.transaction_id = t.id AND a.workspace_id = t.workspace_id
                    WHERE t.workspace_id = :ws
                      AND t.description <> :desc
                      AND similarity(t.description, :desc) >= :th
                    ORDER BY sim DESC
                    LIMIT 1
                    """
                ),
                {"ws": WS, "desc": tx.description, "th": THRESHOLD},
            ).first()
            if row is not None:
                hits += 1
                if len(examples) < 10:
                    examples.append((tx.description, row.match_desc, float(row.sim)))

        rate = 100.0 * hits / len(sample) if sample else 0.0
        print("=" * 60)
        print("PROBE TRGM (memória por similaridade lexical)")
        print("=" * 60)
        print(f"  Sem categoria hoje ......... {n_uncat}")
        print(f"  Amostra avaliada ........... {len(sample)}")
        print(f"  Resolvidas por trgm@{THRESHOLD} .. {hits}  ({rate:.1f}% da amostra)")
        est = int(round(n_uncat * rate / 100.0))
        print(f"  Estimativa no total ........ ~{est} de {n_uncat} resolvidas por trgm")
        print("\n  Exemplos (desconhecida  ->  parecida ja categorizada):")
        for src, match, sim in examples:
            print(f"   [{sim:.2f}] {src[:34]:<34} -> {match[:34]}")
        print("=" * 60)
    finally:
        db.close()


if __name__ == "__main__":
    main()
