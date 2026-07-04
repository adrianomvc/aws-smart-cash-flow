"""Async import worker: o upload cria um job pendente e o worker o finaliza."""

from collections.abc import Iterator
from io import BytesIO
from uuid import uuid4

import pytest
from fastapi import UploadFile
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.auth import AuthContext
from app.db.models import (
    Base,
    ImportError,
    ImportJob,
    SourceFile,
    SourceFileContent,
    Transaction,
    User,
    Workspace,
)
from app.domain.imports import ImportStatus
from app.services import import_worker
from app.services.import_service import ImportService
from app.services.storage_service import StoredFile


@pytest.fixture()
def db_session() -> Iterator[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)

    with session_factory() as session:
        yield session


class FakeStorage:
    def store_original_file(
        self,
        workspace_id: str,
        original_filename: str,
        content: bytes,
        source_file_id: str | None = None,
    ) -> StoredFile:
        return StoredFile(
            bucket="financial-files",
            path=f"{workspace_id}/{source_file_id}/{original_filename}",
        )


def _no_dispatch(monkeypatch: pytest.MonkeyPatch) -> None:
    """Deixa o job em pending para o teste acionar o worker manualmente."""
    monkeypatch.setattr(import_worker, "dispatch_import_job", lambda *args, **kwargs: None)


@pytest.mark.anyio
async def test_upload_creates_pending_job_then_worker_completes_it(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _no_dispatch(monkeypatch)
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))
    service = ImportService(db_session, storage=FakeStorage())
    upload = UploadFile(
        filename="extrato.txt",
        file=BytesIO(b"01/07/2025;PIX TRANSF DANIELL01/07;-10,00\n"),
    )

    result = await service.process_upload(auth=auth, file=upload)

    assert result.status == ImportStatus.PENDING
    assert result.valid_rows == 0
    job = db_session.get(ImportJob, result.import_job_id)
    assert job is not None
    assert job.status == "pending"
    assert job.started_at is None
    blob = db_session.get(SourceFileContent, result.source_file_id)
    assert blob is not None
    assert blob.content.startswith(b"01/07/2025")

    import_worker.run_import_job(result.import_job_id, db=db_session)

    db_session.refresh(job)
    assert job.status == "completed"
    assert job.valid_rows == 1
    assert job.started_at is not None
    assert job.finished_at is not None
    assert len(db_session.scalars(select(Transaction)).all()) == 1


@pytest.mark.anyio
async def test_worker_does_not_mark_own_file_as_duplicate_without_valid_rows(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _no_dispatch(monkeypatch)
    auth = AuthContext(user_id=str(uuid4()), workspace_id=str(uuid4()))
    service = ImportService(db_session, storage=FakeStorage())
    upload = UploadFile(
        filename="extrato.txt",
        file=BytesIO(b"linha sem formato reconhecivel\n"),
    )

    result = await service.process_upload(auth=auth, file=upload)
    import_worker.run_import_job(result.import_job_id, db=db_session)

    job = db_session.get(ImportJob, result.import_job_id)
    assert job is not None
    # O worker encontra o próprio SourceFile pelo hash; isso não pode virar
    # "duplicate_file" — é a primeira importação deste arquivo.
    assert job.status in {"completed", "completed_with_errors"}
    assert job.valid_rows == 0


def test_worker_marks_job_failed_when_content_is_missing(db_session: Session) -> None:
    workspace = Workspace(id=str(uuid4()), name="W")
    user = User(id=str(uuid4()), supabase_user_id=str(uuid4()), email="w@example.com")
    db_session.add_all([workspace, user])
    db_session.flush()
    source_file = SourceFile(
        id=str(uuid4()),
        workspace_id=workspace.id,
        original_filename="extrato.txt",
        content_hash="0" * 64,
        mime_type="text/plain",
        size_bytes=10,
        storage_bucket="financial-files",
        storage_path="x/extrato.txt",
        source_kind="bank_statement_txt",
        created_by_user_id=user.id,
    )
    job = ImportJob(
        id=str(uuid4()),
        workspace_id=workspace.id,
        source_file_id=source_file.id,
        status="pending",
    )
    db_session.add_all([source_file, job])
    db_session.commit()

    import_worker.run_import_job(job.id, db=db_session)

    db_session.refresh(job)
    assert job.status == "failed"
    assert job.finished_at is not None
    errors = db_session.scalars(select(ImportError)).all()
    assert len(errors) == 1
    assert errors[0].error_code == "processing_failed"


def test_worker_skips_jobs_that_are_not_pending(db_session: Session) -> None:
    workspace = Workspace(id=str(uuid4()), name="W")
    user = User(id=str(uuid4()), supabase_user_id=str(uuid4()), email="w2@example.com")
    db_session.add_all([workspace, user])
    db_session.flush()
    source_file = SourceFile(
        id=str(uuid4()),
        workspace_id=workspace.id,
        original_filename="extrato.txt",
        content_hash="1" * 64,
        mime_type="text/plain",
        size_bytes=10,
        storage_bucket="financial-files",
        storage_path="x/extrato.txt",
        source_kind="bank_statement_txt",
        created_by_user_id=user.id,
    )
    job = ImportJob(
        id=str(uuid4()),
        workspace_id=workspace.id,
        source_file_id=source_file.id,
        status="completed",
        valid_rows=5,
    )
    db_session.add_all([source_file, job])
    db_session.commit()

    import_worker.run_import_job(job.id, db=db_session)

    db_session.refresh(job)
    assert job.status == "completed"
    assert job.valid_rows == 5
