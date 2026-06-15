"""Leave-one-out PRECISION probe for the pg_trgm 'memory' layer, by family.

For each sampled already-categorized transaction we hide it, ask trgm for the
most similar OTHER categorized transaction (excluding identical text, so we
measure fuzzy generalization, not exact repeats), and compare the predicted
category against the real one. Read-only.

Ground truth = current category (mostly rule-assigned). Caveat: if rules lump a
whole family into one bucket, precision against that truth looks high even when
the family is semantically ambiguous (e.g. PIX to different people).

Run: .venv/Scripts/python.exe -m scripts.eval_trgm_precision [sample]
"""

from __future__ import annotations

import random
import sys

from sqlalchemy import select, text

from app.core.auth import LOCAL_WORKSPACE_ID
from app.db.models import Category, Transaction, TransactionCategoryAssignment
from app.db.session import SessionLocal

WS = LOCAL_WORKSPACE_ID
THRESHOLDS = [0.45, 0.55, 0.65, 0.75]


def family_of(desc: str) -> str:
    d = " ".join((desc or "").lower().split())
    if d.startswith("pix"):
        return "PIX (transfer.)"
    if d.startswith("ted") or d.startswith("doc"):
        return "TED/DOC"
    if any(t in d for t in ("tit ", "dda", "boleto", "pgto bol", "pag bol")):
        return "Boleto/Titulo"
    if "cartao" in d or "fatura" in d:
        return "Cartao/Fatura"
    if any(t in d for t in ("saque", "tarifa", "iof", "rendiment", "ch compensado", "juros")):
        return "Banco/Tarifas"
    return "Comerciante/Outros"


def main() -> None:
    sample_size = int(sys.argv[1]) if len(sys.argv) > 1 else 400
    db = SessionLocal()
    try:
        cats = {c.id: c for c in db.scalars(select(Category).where(Category.workspace_id == WS)).all()}

        def cat_path(cid: str | None) -> str:
            if not cid or cid not in cats:
                return "—"
            c = cats[cid]
            if c.parent_category_id and c.parent_category_id in cats:
                return f"{cats[c.parent_category_id].name} > {c.name}"
            return c.name

        assigns = {
            a.transaction_id: a.category_id
            for a in db.scalars(
                select(TransactionCategoryAssignment).where(
                    TransactionCategoryAssignment.workspace_id == WS,
                    TransactionCategoryAssignment.category_id.is_not(None),
                )
            ).all()
        }
        categorized = [
            tx for tx in db.scalars(select(Transaction).where(Transaction.workspace_id == WS)).all()
            if tx.id in assigns and (tx.description or "").strip()
        ]
        rng = random.Random(42)
        rng.shuffle(categorized)
        sample = categorized[:sample_size]

        # results[threshold][family] = [covered, correct]
        agg: dict[float, dict[str, list[int]]] = {th: {} for th in THRESHOLDS}
        cases: list[tuple] = []  # (family, desc, match_desc, sim, pred, actual, ok)

        for tx in sample:
            actual = assigns[tx.id]
            fam = family_of(tx.description)
            row = db.execute(
                text(
                    """
                    SELECT a.category_id AS cat, t.description AS md,
                           similarity(t.description, :desc) AS sim
                    FROM transactions t
                    JOIN transaction_category_assignments a
                      ON a.transaction_id = t.id AND a.workspace_id = t.workspace_id
                    WHERE t.workspace_id = :ws
                      AND a.category_id IS NOT NULL
                      AND t.description <> :desc
                    ORDER BY similarity(t.description, :desc) DESC
                    LIMIT 1
                    """
                ),
                {"ws": WS, "desc": tx.description},
            ).first()
            sim = float(row.sim) if row else 0.0
            pred = str(row.cat) if row and row.cat else None
            for th in THRESHOLDS:
                bucket = agg[th].setdefault(fam, [0, 0])
                if row is not None and sim >= th:
                    bucket[0] += 1
                    if pred == actual:
                        bucket[1] += 1
            if row is not None and sim >= 0.45:
                cases.append((fam, tx.description, row.md, sim, pred, actual, pred == actual))

        print("=" * 74)
        print(f"PRECISAO TRGM (leave-one-out) — amostra {len(sample)} categorizadas")
        print("=" * 74)

        print("\n-- VARREDURA DE THRESHOLD (geral) ----------------------------------")
        print(f"  {'thr':>5} {'cobertura':>11} {'precisao':>10}")
        for th in THRESHOLDS:
            cov = sum(v[0] for v in agg[th].values())
            cor = sum(v[1] for v in agg[th].values())
            cov_p = 100.0 * cov / len(sample)
            pre_p = 100.0 * cor / cov if cov else 0.0
            print(f"  {th:>5.2f} {cov_p:>10.1f}% {pre_p:>9.1f}%")

        print("\n-- POR FAMILIA @0.45 -----------------------------------------------")
        print(f"  {'familia':<20} {'n':>5} {'cobertura':>11} {'precisao':>10}")
        fam_total: dict[str, int] = {}
        for tx in sample:
            fam_total[family_of(tx.description)] = fam_total.get(family_of(tx.description), 0) + 1
        for fam in sorted(fam_total, key=lambda f: -fam_total[f]):
            cov, cor = agg[0.45].get(fam, [0, 0])
            cov_p = 100.0 * cov / fam_total[fam] if fam_total[fam] else 0.0
            pre_p = 100.0 * cor / cov if cov else 0.0
            print(f"  {fam:<20} {fam_total[fam]:>5} {cov_p:>10.1f}% {pre_p:>9.1f}%")

        # ---- Casos concretos -------------------------------------------------
        def show(title: str, rows: list[tuple]) -> None:
            print(f"\n-- CASOS: {title} ".ljust(74, "-"))
            for _fam, desc, md, sim, pred, actual, ok in rows:
                mark = "OK " if ok else "ERR"
                print(f"  [{mark} {sim:.2f}] {desc[:30]:<30} ~ {md[:26]:<26}")
                print(f"            previu: {cat_path(pred)[:32]:<32} | real: {cat_path(actual)}")

        wrong = [c for c in cases if not c[6]]
        pix = [c for c in cases if c[0] == "PIX (transfer.)"][:6]
        merch = [c for c in cases if c[0] == "Comerciante/Outros"][:6]
        show("ERROS (previu != real) — risco de precisao", wrong[:10])
        show("PIX / transferencias", pix)
        show("Comerciante / Outros", merch)
        print("\n" + "=" * 74)
    finally:
        db.close()


if __name__ == "__main__":
    main()
