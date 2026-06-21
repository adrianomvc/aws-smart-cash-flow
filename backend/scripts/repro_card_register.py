"""Throwaway: run the FULL import end-to-end against local DB for a real PDF and
report whether the credit card gets registered — surfacing any swallowed error.

Rolls back at the end (never persists)."""

import sys
import traceback

from app.core.auth import AuthContext, LOCAL_USER_ID, LOCAL_WORKSPACE_ID
from app.db.models import CreditCard
from app.db.session import SessionLocal
from app.services.import_service import ImportService
from sqlalchemy import select


def main(path: str) -> None:
    content = open(path, "rb").read()
    filename = path.replace("\\", "/").split("/")[-1]
    db = SessionLocal()
    auth = AuthContext(user_id=LOCAL_USER_ID, workspace_id=LOCAL_WORKSPACE_ID, email="x@x")
    try:
        svc = ImportService(db)
        result = svc.import_bytes(
            auth=auth,
            filename=filename,
            mime_type="application/pdf",
            storage_bucket="local",
            storage_path=f"local/{filename}",
            content=content,
        )
        print(f"import status={result.status} valid={result.valid_rows} dup={result.duplicate_rows}")

        cards = db.scalars(
            select(CreditCard).where(CreditCard.workspace_id == LOCAL_WORKSPACE_ID)
        ).all()
        print(f"Cartoes no workspace apos import: {len(cards)}")
        for c in cards:
            print(f"  - {c.name} final={c.last_four} brand={c.brand} active={c.active} limite={c.limit_amount}")

        # Re-run the registration directly to see if it raises (the import swallows it).
        print("\n--- chamada direta de _register_pdf_credit_card (sem try/except) ---")
        from app.db.models import SourceFile
        sf = db.scalar(select(SourceFile).where(SourceFile.workspace_id == LOCAL_WORKSPACE_ID).order_by(SourceFile.created_at.desc()))
        pr = svc._parse(svc._resolve_source_kind(filename, content, None), content, None)
        print("parse_result.credit_card:", pr.credit_card)
        try:
            svc._register_pdf_credit_card(LOCAL_WORKSPACE_ID, sf, pr)
            print("registro OK (sem excecao)")
        except Exception:
            print("EXCECAO no registro:")
            traceback.print_exc()
    finally:
        db.rollback()
        db.close()


if __name__ == "__main__":
    main(sys.argv[1])
