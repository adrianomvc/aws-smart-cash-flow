from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import AuthContext
from app.db.models import User, Workspace, WorkspaceMember


class WorkspaceService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_or_create_current_workspace(
        self,
        auth: AuthContext,
    ) -> tuple[User, Workspace, WorkspaceMember]:
        user = self.db.scalar(select(User).where(User.supabase_user_id == auth.user_id))
        if user is None:
            user = User(
                id=auth.user_id,
                supabase_user_id=auth.user_id,
                email=auth.email or f"{auth.user_id}@local.invalid",
                display_name=auth.name,
            )
            self.db.add(user)
            self.db.flush()
        elif not user.display_name and auth.name:
            # Backfill the name once it is available from the identity provider.
            user.display_name = auth.name
            self.db.flush()

        if auth.workspace_id is not None:
            workspace = self.db.get(Workspace, auth.workspace_id)
            if workspace is None:
                workspace = Workspace(id=auth.workspace_id, name="Local workspace")
                self.db.add(workspace)
                self.db.flush()
            membership = self._get_membership(workspace_id=workspace.id, user_id=user.id)
            if membership is None:
                membership = WorkspaceMember(
                    id=str(uuid4()),
                    workspace_id=workspace.id,
                    user_id=user.id,
                    role="owner",
                )
                self.db.add(membership)
                self.db.flush()
            return user, workspace, membership

        membership = self.db.scalar(
            select(WorkspaceMember)
            .where(WorkspaceMember.user_id == user.id)
            .order_by(WorkspaceMember.created_at, WorkspaceMember.id)
        )
        if membership is not None:
            workspace = self.db.get(Workspace, membership.workspace_id)
            if workspace is not None:
                return user, workspace, membership

        workspace = Workspace(id=str(uuid4()), name="Meu workspace")
        membership = WorkspaceMember(
            id=str(uuid4()),
            workspace_id=workspace.id,
            user_id=user.id,
            role="owner",
        )
        self.db.add(workspace)
        self.db.add(membership)
        self.db.flush()
        return user, workspace, membership

    def _get_membership(self, workspace_id: str, user_id: str) -> WorkspaceMember | None:
        return self.db.scalar(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id,
            )
        )
