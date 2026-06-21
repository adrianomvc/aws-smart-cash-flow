"""Throwaway: clean the Visa 2026_05 import residue and re-import it fresh, then
verify the invoice-competence filter returns the statement's transactions."""

from datetime import date

from sqlalchemy import func, select

from app.core.auth import LOCAL_USER_ID, LOCAL_WORKSPACE_ID, AuthContext
from app.db.models import (
    CreditCardStatement,
    ImportJob,
    RawTransactionLine,
    SourceFile,
    Transaction,
)
from app.db.models import (
    ImportError as ImportErrorRow,
)
from app.db.session import SessionLocal
from app.services.import_service import ImportService

PDF = r"G:/Meu Drive/Financas/Faturas/BKP/FATURA_PERSONNALITE_VISA_INFINITE_2026_05.pdf"


def main() -> None:
    db = SessionLocal()
    auth = AuthContext(user_id=LOCAL_USER_ID, workspace_id=LOCAL_WORKSPACE_ID, email="x@x")
    try:
        sf = db.scalar(
            select(SourceFile).where(SourceFile.original_filename.like("%VISA_INFINITE_2026_05%"))
        )
        if sf is not None:
            sfid = sf.id
            db.query(Transaction).filter(Transaction.source_file_id == sfid).delete()
            db.query(ImportErrorRow).filter(
                ImportErrorRow.import_job_id.in_(
                    select(ImportJob.id).where(ImportJob.source_file_id == sfid)
                )
            ).delete(synchronize_session=False)
            db.query(RawTransactionLine).filter(
                RawTransactionLine.source_file_id == sfid
            ).delete()
            db.query(CreditCardStatement).filter(
                CreditCardStatement.source_file_id == sfid
            ).delete()
            db.query(ImportJob).filter(ImportJob.source_file_id == sfid).delete()
            db.query(SourceFile).filter(SourceFile.id == sfid).delete()
            db.commit()
            print(f"Removido residuo do Visa (sf={sfid})")

        content = open(PDF, "rb").read()
        result = ImportService(db).import_bytes(
            auth=auth, filename="FATURA_PERSONNALITE_VISA_INFINITE_2026_05.pdf",
            mime_type="application/pdf", storage_bucket="local",
            storage_path="local/visa.pdf", content=content,
        )
        print(f"Re-import status={result.status} valid={result.valid_rows}")

        # Verify competence filter
        competence = func.coalesce(
            CreditCardStatement.closing_date, CreditCardStatement.statement_month
        )
        def comp_count(a, b):
            sub = select(CreditCardStatement.source_file_id).where(
                CreditCardStatement.workspace_id == LOCAL_WORKSPACE_ID,
                CreditCardStatement.source_file_id.is_not(None),
                competence >= a, competence <= b,
            )
            return db.scalar(
                select(func.count()).select_from(Transaction).where(
                    Transaction.workspace_id == LOCAL_WORKSPACE_ID,
                    Transaction.source_file_id.in_(sub),
                )
            )
        st = db.scalar(select(CreditCardStatement).where(
            CreditCardStatement.source_file_id == db.scalar(
                select(SourceFile.id).where(SourceFile.original_filename.like("%VISA_INFINITE_2026_05%")))))
        print(f"Visa statement: closing={st.closing_date} due={st.due_date} month={st.statement_month}")
        print("competence maio/2026:", comp_count(date(2026, 5, 1), date(2026, 5, 31)))
        print("competence abril/2026:", comp_count(date(2026, 4, 1), date(2026, 4, 30)))
        print("competence junho/2026:", comp_count(date(2026, 6, 1), date(2026, 6, 30)))
    finally:
        db.close()


if __name__ == "__main__":
    main()
