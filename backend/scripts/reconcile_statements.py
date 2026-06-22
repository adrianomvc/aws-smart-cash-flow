"""Reconciliation harness for Itaú credit-card statement PDFs.

Parses every PDF in a folder, compares the imported sum with the printed
statement total, and prints a per-file diff plus a summary. Used to validate
parser changes against the real BKP statements without regressing.

Usage: python scripts/reconcile_statements.py ["<folder>"]
"""

import sys
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader

from app.services.parsers import (
    _ITAU_PDF_TOTAL_RE,
    TransactionDirection,
    parse_brazilian_decimal,
    parse_itau_credit_card_pdf,
)

DEFAULT_FOLDER = r"G:/Meu Drive/Financas/Faturas/BKP"
TOLERANCE = Decimal("1.00")


def _statement_total(text: str) -> Decimal | None:
    match = _ITAU_PDF_TOTAL_RE.search(text)
    return parse_brazilian_decimal(match.group(1)) if match else None


def main(folder: str) -> None:
    paths = sorted(Path(folder).glob("*.pdf"))
    if not paths:
        print(f"No PDFs in {folder}")
        return
    ok = mismatch = no_total = 0
    worst: list[tuple[Decimal, str, Decimal, Decimal]] = []
    for path in paths:
        content = path.read_bytes()
        result = parse_itau_credit_card_pdf(content)
        text = "\n".join(
            (pg.extract_text(extraction_mode="layout") or "")
            for pg in PdfReader(BytesIO(content)).pages
        )
        total = _statement_total(text)
        imported = sum(
            (
                t.amount if t.direction == TransactionDirection.DEBIT else -t.amount
                for t in result.transactions
                if t.direction != TransactionDirection.PAYMENT
            ),
            Decimal("0"),
        )
        if total is None:
            no_total += 1
            print(f"  [no-total] {path.name}: imported={imported} ({len(result.transactions)} tx)")
            continue
        diff = total - imported
        if abs(diff) <= TOLERANCE:
            ok += 1
        else:
            mismatch += 1
            worst.append((abs(diff), path.name, total, imported))
            print(f"  [DIFF {diff:>10}] {path.name}: total={total} imported={imported} ({len(result.transactions)} tx)")

    print("\n=== summary ===")
    print(f"  files: {len(paths)} | ok: {ok} | mismatch: {mismatch} | no-total: {no_total}")
    worst.sort(reverse=True)
    if worst:
        print("  worst diffs:")
        for d, name, _total, _imported in worst[:10]:
            print(f"    {d:>10}  {name}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_FOLDER)
