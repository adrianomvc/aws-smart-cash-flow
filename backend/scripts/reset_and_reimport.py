"""Throwaway: delete an imported statement's residue and re-import it fresh so
parser/import changes (IOF date, payment_date) apply to existing data.

Usage: python scripts/reset_and_reimport.py "<filename-substring>" "<pdf-path>"
"""

import sys

from sqlalchemy import select

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


def main(substring: str, path: str) -> None:
    db = SessionLocal()
    auth = AuthContext(user_id=LOCAL_USER_ID, workspace_id=LOCAL_WORKSPACE_ID, email="x@x")
    filename = path.replace("\\", "/").split("/")[-1]
    try:
        for sf in db.scalars(
            select(SourceFile).where(SourceFile.original_filename.like(f"%{substring}%"))
        ).all():
            sfid = sf.id
            db.query(Transaction).filter(Transaction.source_file_id == sfid).delete()
            db.query(ImportErrorRow).filter(
                ImportErrorRow.import_job_id.in_(
                    select(ImportJob.id).where(ImportJob.source_file_id == sfid)
                )
            ).delete(synchronize_session=False)
            db.query(RawTransactionLine).filter(RawTransactionLine.source_file_id == sfid).delete()
            db.query(CreditCardStatement).filter(CreditCardStatement.source_file_id == sfid).delete()
            db.query(ImportJob).filter(ImportJob.source_file_id == sfid).delete()
            db.query(SourceFile).filter(SourceFile.id == sfid).delete()
            db.commit()
            print(f"Removido residuo de {sf.original_filename} (sf={sfid})")

        content = open(path, "rb").read()
        result = ImportService(db).import_bytes(
            auth=auth, filename=filename, mime_type="application/pdf",
            storage_bucket="local", storage_path=f"local/{filename}", content=content,
        )
        print(f"Re-import {filename}: status={result.status} valid={result.valid_rows}")
    finally:
        db.close()


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
