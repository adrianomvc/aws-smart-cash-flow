from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.session import get_db
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["workspaces"])
DbDependency = Depends(get_db)


class CurrentWorkspaceResponse(BaseModel):
    user_id: str
    workspace_id: str
    workspace_name: str
    role: str
    created_at: datetime


@router.get("/current")
async def get_current_workspace(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CurrentWorkspaceResponse:
    user, workspace, membership = WorkspaceService(db).get_or_create_current_workspace(auth)
    db.commit()
    return CurrentWorkspaceResponse(
        user_id=user.id,
        workspace_id=workspace.id,
        workspace_name=workspace.name,
        role=membership.role,
        created_at=workspace.created_at,
    )
