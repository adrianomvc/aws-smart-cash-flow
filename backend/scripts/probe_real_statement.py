"""Throwaway: run the real parser against a real Itau statement PDF and report.

Usage: python scripts/probe_real_statement.py "<path-to.pdf>"
Prints card metadata, transaction count, reconciliation and installment lines.
"""

import sys
from collections import Counter
from decimal import Decimal

from app.domain.imports import TransactionDirection
from app.services.parsers import (
    extract_itau_card_metadata,
    parse_itau_credit_card_pdf,
)


def main(path: str) -> None:
    content = open(path, "rb").read()
    result = parse_itau_credit_card_pdf(content)

    # Re-extract text for metadata (parser keeps best ParseResult, not the text).
    from io import BytesIO

    from pypdf import PdfReader

    pages = list(PdfReader(BytesIO(content)).pages)
    text = "\n".join((p.extract_text(extraction_mode="layout") or "") for p in pages)
    card = extract_itau_card_metadata(text)

    print(f"\n=== {path.split('/')[-1]} ===")
    if card:
        print(
            f"Cartao: {card.name} | bandeira={card.brand} | final={card.last_four} | "
            f"fech={card.closing_date} venc={card.due_date} | total={card.statement_total} | "
            f"limite={card.limit_amount}"
        )
    else:
        print("Cartao: NAO IDENTIFICADO")

    txs = result.transactions
    dirs = Counter(t.direction for t in txs)
    print(f"Transacoes: {len(txs)}  ({dict(dirs)})")
    if result.errors:
        for e in result.errors:
            print(f"  ERRO[{e.error_code}]: {e.message}")

    debit = sum((t.amount for t in txs if t.direction == TransactionDirection.DEBIT), Decimal("0"))
    credit = sum((t.amount for t in txs if t.direction == TransactionDirection.CREDIT), Decimal("0"))
    print(f"Soma debitos={debit}  creditos={credit}  liquido={debit - credit}")

    installments = [t for t in txs if t.installment_total]
    print(f"\nParcelas detectadas ({len(installments)}):")
    for t in installments[:25]:
        print(
            f"  {t.transaction_date} {t.description[:34]:34} "
            f"{t.installment_current}/{t.installment_total}  R$ {t.amount}"
        )


if __name__ == "__main__":
    main(sys.argv[1])
