"""Read-only evaluation harness: simulates the proposed layered categorization
architecture over the CURRENT data and prints the numbers that validate (or
refute) the thesis — coverage per cheap layer and the real LLM-call ceiling
with caching. Does NOT write anything.

Run:  .venv/Scripts/python.exe -m scripts.eval_pipeline
"""

from __future__ import annotations

from collections import Counter

from sqlalchemy import select

from app.core.auth import LOCAL_WORKSPACE_ID
from app.db.models import CategorizationRule, Transaction, TransactionCategoryAssignment
from app.db.session import SessionLocal
from app.services.categorization_service import CategorizationService

WS = LOCAL_WORKSPACE_ID


def pct(n: int, d: int) -> str:
    return f"{(100.0 * n / d):5.1f}%" if d else "  0.0%"


def bar(label: str, n: int, total: int) -> str:
    return f"  {label:<34} {n:>6}  ({pct(n, total)})"


def main() -> None:
    db = SessionLocal()
    svc = CategorizationService(db)
    try:
        txs = db.scalars(
            select(Transaction).where(Transaction.workspace_id == WS)
        ).all()
        total = len(txs)

        assignments = {
            a.transaction_id: a
            for a in db.scalars(
                select(TransactionCategoryAssignment).where(
                    TransactionCategoryAssignment.workspace_id == WS
                )
            ).all()
        }
        rules = db.scalars(
            select(CategorizationRule)
            .where(CategorizationRule.workspace_id == WS, CategorizationRule.active.is_(True))
            .order_by(CategorizationRule.priority, CategorizationRule.created_at)
        ).all()

        print("=" * 64)
        print(f"BASE ATUAL — workspace {WS}")
        print("=" * 64)
        print(f"  Transações: {total}")
        print(f"  Regras ativas: {len(rules)}")

        # --- Estado atual (o que já está categorizado e por qual fonte) -------
        by_source: Counter[str] = Counter()
        by_review: Counter[str] = Counter()
        confidences: list[float] = []
        for tx in txs:
            a = assignments.get(tx.id)
            if a is None or a.category_id is None:
                by_source["(sem categoria)"] += 1
                continue
            by_source[a.source] += 1
            by_review[a.review_status or "(none)"] += 1
            if a.confidence is not None and a.source not in ("manual", "rule"):
                confidences.append(float(a.confidence))
        categorized = total - by_source["(sem categoria)"]

        print("\n-- ESTADO ATUAL ----------------------------------------------")
        print(bar("categorizadas", categorized, total))
        for src, n in by_source.most_common():
            print(bar(f"  fonte: {src}", n, total))

        # --- Chave de memória / dicionário (descrição normalizada) -----------
        key_of = {tx.id: svc._normalize_for_match(tx.description or "", "description") for tx in txs}
        keys = [k for k in key_of.values() if k]
        unique_keys = set(keys)
        key_counts = Counter(keys)
        repeats = total - len(unique_keys)

        print("\n-- DEDUPE / CACHE (descrição normalizada) --------------------")
        print(f"  Descrições únicas .............. {len(unique_keys):>6}  de {total} transações")
        print(f"  Fator de repetição ............. {total / max(1, len(unique_keys)):>6.2f}x  "
              f"(transações por descrição única)")
        print(bar("repetições (grátis após 1ª vez)", repeats, total))
        top = key_counts.most_common(8)
        print("  Top descrições recorrentes:")
        for k, n in top:
            print(f"     {n:>4}x  {k[:48]}")

        # --- Camada 1: Regras determinísticas (dry-run) ----------------------
        rule_hit_tx: set[str] = set()
        rule_hit_keys: set[str] = set()
        for tx in txs:
            for rule in rules:
                if svc.matches(rule, tx):
                    rule_hit_tx.add(tx.id)
                    if key_of[tx.id]:
                        rule_hit_keys.add(key_of[tx.id])
                    break

        # --- Camada 2: Memória exata (ground truth = correções manuais) ------
        # Uma descrição é "conhecida" se ALGUMA transação com essa chave foi
        # categorizada manualmente pelo usuário. Então TODAS as outras com a
        # mesma chave seriam resolvidas de graça por lookup O(1).
        manual_keys: set[str] = set()
        for tx in txs:
            a = assignments.get(tx.id)
            if a is not None and a.source == "manual" and a.category_id is not None and key_of[tx.id]:
                manual_keys.add(key_of[tx.id])

        mem_hit_tx = {
            tx.id for tx in txs
            if key_of[tx.id] in manual_keys and tx.id not in rule_hit_tx
        }

        covered_tx = rule_hit_tx | mem_hit_tx
        remaining_tx = [tx for tx in txs if tx.id not in covered_tx]
        remaining_keys = {key_of[tx.id] for tx in remaining_tx if key_of[tx.id]}

        print("\n-- SIMULAÇÃO DA ARQUITETURA (do zero, sem nada categorizado) -")
        print(bar("Camada 1 — Regras", len(rule_hit_tx), total))
        print(bar("Camada 2 — Memória exata (manual)", len(mem_hit_tx), total))
        print(bar("  subtotal coberto (grátis)", len(covered_tx), total))
        print(bar("  resta p/ trgm + LLM", len(remaining_tx), total))

        # --- Teto de LLM com cache -------------------------------------------
        print("\n-- TETO DE LLM (com cache por descrição) ---------------------")
        print(f"  Sem cache, sem camadas ......... {total:>6} chamadas (1 por transação)")
        print(f"  Só com cache de descrição ...... {len(unique_keys):>6} chamadas (1 por descrição única)")
        print(f"  Cache + regras + memória ....... {len(remaining_keys):>6} chamadas no MÁXIMO, "
              f"uma vez na vida ({pct(len(remaining_keys), total)} do volume)")

        # --- Distribuição de confiança (viabilidade de tiers) ----------------
        if confidences:
            confidences.sort()
            n = len(confidences)
            buckets = {"≥0.90 (auto-aplica)": 0, "0.70–0.90 (sugere)": 0, "<0.70 (revisão)": 0}
            for c in confidences:
                if c >= 0.90:
                    buckets["≥0.90 (auto-aplica)"] += 1
                elif c >= 0.70:
                    buckets["0.70–0.90 (sugere)"] += 1
                else:
                    buckets["<0.70 (revisão)"] += 1
            print("\n-- CONFIANÇA DAS SUGESTÕES (máquina) — viabilidade de tiers --")
            print(f"  amostra: {n} atribuições (trgm/llm)")
            for label, cnt in buckets.items():
                print(bar(label, cnt, n))
            print(f"  mediana de confiança ........... {confidences[n // 2]:.2f}")
        else:
            print("\n-- CONFIANÇA: nenhuma sugestão de máquina com confidence na base.")

        print("\n" + "=" * 64)
    finally:
        db.close()


if __name__ == "__main__":
    main()
