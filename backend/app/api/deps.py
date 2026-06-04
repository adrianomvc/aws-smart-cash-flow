from dataclasses import dataclass

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import User, Workspace, WorkspaceMember
from app.db.session import get_db
from app.services.workspace_service import WorkspaceService

DbDependency = Depends(get_db)


@dataclass(frozen=True)
class CurrentWorkspaceContext:
    auth: AuthContext
    user: User
    workspace: Workspace
    membership: WorkspaceMember

    @property
    def workspace_id(self) -> str:
        return self.workspace.id

    @property
    def user_id(self) -> str:
        return self.user.id


def get_current_workspace_context(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CurrentWorkspaceContext:
    user, workspace, membership = WorkspaceService(db).get_or_create_current_workspace(auth)
    db.commit()

    return CurrentWorkspaceContext(
        auth=auth,
        user=user,
        workspace=workspace,
        membership=membership,
    )


CurrentWorkspaceDependency = Depends(get_current_workspace_context)
