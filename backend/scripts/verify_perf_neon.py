"""Post-Neon verification for the performance / Network-Transfer work.

Run it once Neon is back, with the prod env loaded (so SessionLocal points at
Neon):

    cd backend
    ./.venv/Scripts/python.exe scripts/verify_perf_neon.py [workspace_id]

It checks three things:
  1. The composite indexes from migration 0030 exist (Postgres only).
  2. The dashboard aggregations run and return FEW rows (a proxy for low egress),
     with timing.
  3. EXPLAIN confirms the hot transaction filters use an index (Postgres only).

The real Network-Transfer number is the Neon console graph — compare it before
and after the deploy. This script proves the queries aggregate in the DB and the
indexes are in place.
"""

import sys
import time

from sqlalchemy import func, select, text

from app.db.models import Transaction
from app.db.session import SessionLocal
from app.services.dashboard_service import DashboardService

EXPECTED_INDEXES = [
    "ix_transactions_workspace_date",
    "ix_transactions_workspace_payment_date",
    "ix_transactions_workspace_direction_date",
    "ix_transactions_workspace_source_file",
    "ix_transactions_workspace_import_job",
    "ix_assignments_workspace_transaction",
    "ix_assignments_workspace_category",
    "ix_categories_workspace_parent",
    "ix_import_jobs_workspace_created",
    "ix_source_files_workspace_received",
]


def main() -> int:
    db = SessionLocal()
    try:
        dialect = db.bind.dialect.name
        print(f"dialect: {dialect}")

        # 1) Indexes -------------------------------------------------------------
        missing: list[str] = []
        if dialect == "postgresql":
            existing = {
                row[0] for row in db.execute(text("select indexname from pg_indexes")).all()
            }
            print("\n[indexes]")
            for ix in EXPECTED_INDEXES:
                ok = ix in existing
                if not ok:
                    missing.append(ix)
                print(f"  {'OK     ' if ok else 'MISSING'} {ix}")
        else:
            print("\n[indexes] skipped (not Postgres; created via Alembic migration in prod)")

        # Workspace under test ---------------------------------------------------
        ws = (
            sys.argv[1]
            if len(sys.argv) > 1
            else db.scalar(
                select(Transaction.workspace_id)
                .group_by(Transaction.workspace_id)
                .order_by(func.count().desc())
                .limit(1)
            )
        )
        if ws is None:
            print("\nNo workspace with transactions found — nothing to measure.")
            return 1
        total = db.scalar(
            select(func.count()).select_from(Transaction).where(Transaction.workspace_id == ws)
        )
        print(f"\nworkspace: {ws}  ({total} transactions)")

        # 2) Aggregations: result size (proxy for egress) + timing ---------------
        svc = DashboardService(db)
        checks = [
            ("summary", lambda: svc.summary(ws, None, None)),
            ("category_ranking", lambda: svc.category_ranking(ws, None, None, 50)),
            ("subcategory_ranking", lambda: svc.subcategory_ranking(ws, None, None, None, 50)),
            ("merchant_ranking", lambda: svc.merchant_ranking(ws, None, None, 50)),
            ("expense_size_profile", lambda: svc.expense_size_profile(ws, None, None)),
            ("weekday_spending", lambda: svc.weekday_spending(ws, None, None)),
            ("data_quality", lambda: svc.data_quality(ws, None, None)),
            ("spending_breakdown", lambda: svc.spending_breakdown(ws, None, None)),
        ]
        print("\n[aggregations] rows = result size (proxy for egress)")
        for name, fn in checks:
            start = time.perf_counter()
            result = fn()
            elapsed_ms = (time.perf_counter() - start) * 1000
            rows = len(result) if isinstance(result, list) else 1
            print(f"  {name:22} {rows:4} rows  {elapsed_ms:8.1f} ms")

        # 3) EXPLAIN on the hot filters (Postgres only) --------------------------
        if dialect == "postgresql":
            print("\n[explain] index usage on hot filters")
            probes = [
                (
                    "ws + transaction_date",
                    "select count(*) from transactions "
                    "where workspace_id = :w and transaction_date >= '2000-01-01'",
                ),
                (
                    "ws + direction + date",
                    "select sum(abs(amount)) from transactions "
                    "where workspace_id = :w and direction = 'debit' "
                    "and transaction_date >= '2000-01-01'",
                ),
            ]
            for label, sql in probes:
                plan = db.execute(text(f"explain {sql}"), {"w": ws}).all()
                used_index = any("Index" in row[0] for row in plan)
                print(f"  {label}: {'index scan' if used_index else 'SEQ SCAN (!)'}")
                for row in plan:
                    print(f"      {row[0]}")

        print("\nDone. For the real Network-Transfer number, compare Neon's egress")
        print("graph before vs. after this deploy.")
        return 1 if missing else 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
