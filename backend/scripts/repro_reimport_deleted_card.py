"""Throwaway: simulate delete-card -> re-import-same-PDF and assert reactivation.

Soft-deletes the card matching the PDF's last4, re-imports the SAME file (hits the
duplicate-file path) and reports whether the card came back active. Leaves the card
active (the desired end state)."""

import sys

from app.core.auth import AuthContext, LOCAL_USER_ID, LOCAL_WORKSPACE_ID
from app.db.models import CreditCard
from app.db.session import SessionLocal
from app.services.import_service import ImportService
from app.services.parsers import extract_itau_card_metadata, parse_itau_credit_card_pdf
from sqlalchemy import select


def main(path: str) -> None:
    content = open(path, "rb").read()
    filename = path.replace("\\", "/").split("/")[-1]
    # last4 from the PDF itself
    r = parse_itau_credit_card_pdf(content)
    last4 = r.credit_card.last_four if r.credit_card else None
    print(f"PDF last4={last4}")

    db = SessionLocal()
    auth = AuthContext(user_id=LOCAL_USER_ID, workspace_id=LOCAL_WORKSPACE_ID, email="x@x")
    try:
        card = db.scalar(
            select(CreditCard).where(
                CreditCard.workspace_id == LOCAL_WORKSPACE_ID,
                CreditCard.last_four == last4,
            )
        )
        if card is None:
            print("Cartao nao existe ainda; importando 1a vez para criar...")
            ImportService(db).import_bytes(
                auth=auth, filename=filename, mime_type="application/pdf",
                storage_bucket="local", storage_path=f"local/{filename}", content=content,
            )
            card = db.scalar(select(CreditCard).where(
                CreditCard.workspace_id == LOCAL_WORKSPACE_ID, CreditCard.last_four == last4))

        # 1) soft-delete
        card.active = False
        db.add(card); db.commit()
        print(f"Apos soft-delete: active={card.active}")

        # 2) re-import same file (duplicate-file path)
        result = ImportService(db).import_bytes(
            auth=auth, filename=filename, mime_type="application/pdf",
            storage_bucket="local", storage_path=f"local/{filename}", content=content,
        )
        print(f"Re-import status={result.status}")

        # 3) verify reactivation
        db.expire_all()
        card = db.scalar(select(CreditCard).where(
            CreditCard.workspace_id == LOCAL_WORKSPACE_ID, CreditCard.last_four == last4))
        print(f"Apos re-import: active={card.active}  (esperado True)")
    finally:
        db.close()


if __name__ == "__main__":
    main(sys.argv[1])
