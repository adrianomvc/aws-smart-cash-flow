"""Prove the dashboard derives FUTURE installments from a single charged one.

Seeds ONE charged installment (PANDORA 3/10) into a rolled-back transaction,
then asks DashboardService.credit_card_installments what it reports. If the
future commitment (remaining installments + future amount) shows up without us
ever storing the future rows, option 2 (storing projected rows) is redundant.
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from app.db.models import ImportJob, Transaction
from app.db.session import SessionLocal
from app.services.dashboard_service import DashboardService

WORKSPACE_ID = "00000000000000000000000000000002"
SOURCE_FILE_ID = "53f3dd0421e14457b7b3ebd2e0403660"


def main() -> None:
    db = SessionLocal()
    try:
        # A real statement would create an import job; make a throwaway one.
        job = ImportJob(
            id=str(uuid4()),
            workspace_id=WORKSPACE_ID,
            source_file_id=SOURCE_FILE_ID,
            status="completed",
            total_rows=1,
            valid_rows=1,
            error_rows=0,
            duplicate_rows=0,
        )
        db.add(job)
        db.flush()

        # Only the CURRENT installment is charged. Purchase made 2026-04-10,
        # 10 parcels total, installment 3 is the one on the latest statement.
        tx = Transaction(
            id=str(uuid4()),
            workspace_id=WORKSPACE_ID,
            source_file_id=SOURCE_FILE_ID,
            import_job_id=job.id,
            source_type="credit_card_statement",
            transaction_date=date(2026, 4, 10),  # original purchase date
            description="PANDORA DO BRASIL",
            raw_description="PANDORA DO BRASIL 03/10",
            amount=Decimal("131.80"),
            currency="BRL",
            direction="debit",
            installment_current=3,
            installment_total=10,
            source_line=1,
            dedupe_key=uuid4().hex,
            natural_dedupe_key=uuid4().hex,
            created_at=datetime.now(UTC),
        )
        db.add(tx)
        db.flush()

        service = DashboardService(db)
        print("=== Armazenado no banco: 1 transacao (so a parcela cobrada 3/10) ===\n")
        print("Comprometimento futuro DERIVADO por mes-fatura (nada disso esta gravado):\n")

        # Walk the next invoice months; each derives WHICH installment falls there.
        for offset in range(0, 9):
            month = date(2026, 6, 1)
            y = month.year + (month.month - 1 + offset) // 12
            m = (month.month - 1 + offset) % 12 + 1
            start = date(y, m, 1)
            end = date(y + (1 if m == 12 else 0), 1 if m == 12 else m + 1, 1)
            res = service.credit_card_installments(
                workspace_id=WORKSPACE_ID, date_from=start, date_to=end, limit=10
            )
            for item in res["items"]:
                print(
                    f"  fatura {y}-{m:02d}: {item['description']} "
                    f"parcela {item.get('installment_current')}/{item['installment_total']}"
                    f" -> R$ {item.get('future_amount')}"
                )
    finally:
        db.rollback()  # never persist the seed
        db.close()


if __name__ == "__main__":
    main()
