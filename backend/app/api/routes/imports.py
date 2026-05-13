from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.session import get_db
from app.services.import_service import ImportService

router = APIRouter(prefix="/imports", tags=["imports"])
UploadFileDependency = File(...)
DbDependency = Depends(get_db)


@router.post("")
async def create_import(
    auth: AuthContext = AuthDependency,
    file: UploadFile = UploadFileDependency,
    db: Session = DbDependency,
) -> dict[str, object]:
    result = await ImportService(db).process_upload(auth=auth, file=file)
    return result.model_dump()


@router.get("")
async def list_imports(auth: AuthContext = AuthDependency) -> dict[str, object]:
    return {"workspace_id": auth.workspace_id, "items": []}


@router.get("/{import_job_id}")
async def get_import(import_job_id: str, auth: AuthContext = AuthDependency) -> dict[str, object]:
    return {"workspace_id": auth.workspace_id, "import_job_id": import_job_id}


@router.get("/{import_job_id}/errors")
async def list_import_errors(
    import_job_id: str,
    auth: AuthContext = AuthDependency,
) -> dict[str, object]:
    return {"workspace_id": auth.workspace_id, "import_job_id": import_job_id, "items": []}
