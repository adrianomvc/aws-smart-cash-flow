"""Async processing of import jobs.

The upload request only stores the file and a pending ImportJob; the parse +
persist runs here, outside the API Gateway 30-second window. Dispatch modes:

- ``lambda``: async self-invoke of the backend Lambda (production). Falls back
  to inline processing if the invoke fails (e.g. missing IAM permission).
- ``thread``: daemon background thread (local uvicorn dev).
- ``inline``: synchronous, reusing the caller's session (tests).

Mode is auto-detected (Lambda env → ``lambda``, else ``thread``) and can be
forced with the ``IMPORT_WORKER_MODE`` setting.
"""

import json
import logging
import os
import threading
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.auth import AuthContext
from app.core.config import settings
from app.db.models import ImportError, ImportJob, SourceFile, SourceFileContent
from app.domain.imports import ImportStatus

logger = logging.getLogger("app.import_worker")


def _worker_mode() -> str:
    if settings.import_worker_mode:
        return settings.import_worker_mode
    if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return "lambda"
    return "thread"


def dispatch_import_job(
    db: Session, import_job_id: str, source_kind: str | None = None
) -> None:
    mode = _worker_mode()
    if mode == "lambda":
        try:
            import boto3

            boto3.client("lambda").invoke(
                FunctionName=os.environ["AWS_LAMBDA_FUNCTION_NAME"],
                InvocationType="Event",
                Payload=json.dumps(
                    {
                        "task": "process_import_job",
                        "import_job_id": import_job_id,
                        "source_kind": source_kind,
                    }
                ).encode("utf-8"),
            )
            return
        except Exception:  # noqa: BLE001 - never lose the job: process inline instead
            logger.exception(
                "Async self-invoke failed for import job %s; processing inline",
                import_job_id,
            )
            run_import_job(import_job_id, source_kind=source_kind, db=db)
            return
    if mode == "thread":
        threading.Thread(
            target=run_import_job,
            args=(import_job_id,),
            kwargs={"source_kind": source_kind},
            daemon=True,
        ).start()
        return
    run_import_job(import_job_id, source_kind=source_kind, db=db)


def run_import_job(
    import_job_id: str, source_kind: str | None = None, db: Session | None = None
) -> None:
    if db is not None:
        _run(db, import_job_id, source_kind)
        return
    from app.db.session import SessionLocal

    with SessionLocal() as session:
        _run(session, import_job_id, source_kind)


def _run(db: Session, import_job_id: str, source_kind: str | None) -> None:
    job = db.get(ImportJob, import_job_id)
    if job is None:
        logger.warning("Import job %s not found", import_job_id)
        return
    if job.status != ImportStatus.PENDING.value:
        # Lambda async invokes are retried on crashes; never reprocess a job
        # that already reached (or is heading to) a final state.
        logger.info("Import job %s is %s; skipping", import_job_id, job.status)
        return

    job.status = ImportStatus.PROCESSING.value
    job.started_at = datetime.now(UTC)
    db.commit()

    try:
        source_file = db.get(SourceFile, job.source_file_id)
        blob = db.get(SourceFileContent, job.source_file_id)
        if source_file is None or blob is None:
            raise RuntimeError("Conteúdo do arquivo original não está disponível.")

        from app.services.import_service import ImportService

        ImportService(db).import_bytes(
            auth=AuthContext(
                user_id=source_file.created_by_user_id,
                workspace_id=job.workspace_id,
            ),
            filename=source_file.original_filename,
            mime_type=source_file.mime_type,
            storage_bucket=source_file.storage_bucket,
            storage_path=source_file.storage_path,
            content=blob.content,
            source_kind=source_kind,
            workspace_id=job.workspace_id,
            existing_job=job,
        )
    except Exception as exc:  # noqa: BLE001 - the job must always reach a final state
        logger.exception("Import job %s failed", import_job_id)
        db.rollback()
        job = db.get(ImportJob, import_job_id)
        if job is None:
            return
        job.status = ImportStatus.FAILED.value
        job.finished_at = datetime.now(UTC)
        db.add(
            ImportError(
                id=str(uuid4()),
                workspace_id=job.workspace_id,
                import_job_id=job.id,
                error_code="processing_failed",
                message=str(exc)[:500] or "Falha ao processar o arquivo.",
            )
        )
        db.commit()
