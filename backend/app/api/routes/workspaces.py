from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.models import Transaction, User, WorkspaceInvite, WorkspaceMember
from app.db.session import get_db
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["workspaces"])
DbDependency = Depends(get_db)

_INVITE_ROLES = {"admin", "member", "viewer"}


class CurrentWorkspaceResponse(BaseModel):
    user_id: str
    user_name: str
    workspace_id: str
    workspace_name: str
    role: str
    has_transactions: bool
    created_at: datetime


@router.get("/current")
async def get_current_workspace(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CurrentWorkspaceResponse:
    user, workspace, membership = WorkspaceService(db).get_or_create_current_workspace(auth)
    db.commit()
    has_tx = db.scalar(
        select(Transaction.id).where(Transaction.workspace_id == workspace.id).limit(1)
    ) is not None
    return CurrentWorkspaceResponse(
        user_id=user.id,
        user_name=user.display_name or (user.email.split("@")[0] if user.email else "você"),
        workspace_id=workspace.id,
        workspace_name=workspace.name,
        role=membership.role,
        has_transactions=has_tx,
        created_at=workspace.created_at,
    )


class WorkspaceRename(BaseModel):
    name: str = Field(min_length=1, max_length=120)


@router.patch("/current")
def rename_workspace(
    payload: WorkspaceRename,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CurrentWorkspaceResponse:
    user, workspace, membership = _ctx(db, auth)
    if membership.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and admins can rename the workspace",
        )
    name = payload.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name is required"
        )
    workspace.name = name
    db.commit()
    db.refresh(workspace)
    return CurrentWorkspaceResponse(
        user_id=user.id,
        user_name=user.display_name or (user.email.split("@")[0] if user.email else "você"),
        workspace_id=workspace.id,
        workspace_name=workspace.name,
        role=membership.role,
        created_at=workspace.created_at,
    )


class ProfileRead(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    workspace_name: str


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    email: str | None = Field(default=None, max_length=200)


def _profile_read(user, workspace, membership) -> ProfileRead:
    name = user.display_name or (user.email.split("@")[0] if user.email else "Você")
    return ProfileRead(
        user_id=user.id, name=name, email=user.email or "",
        role=membership.role, workspace_name=workspace.name,
    )


@router.get("/profile")
def get_profile(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> ProfileRead:
    user, workspace, membership = _ctx(db, auth)
    return _profile_read(user, workspace, membership)


@router.patch("/profile")
def update_profile(
    payload: ProfileUpdate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> ProfileRead:
    user, workspace, membership = _ctx(db, auth)
    if payload.display_name is not None:
        user.display_name = payload.display_name.strip() or None
    if payload.email is not None:
        email = payload.email.strip().lower()
        if "@" not in email or "." not in email.split("@")[-1]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid email"
            )
        user.email = email
    db.commit()
    db.refresh(user)
    return _profile_read(user, workspace, membership)


# --------------------------------------------------------------------------- #
# Members & invites
# --------------------------------------------------------------------------- #
class MemberRead(BaseModel):
    id: str
    user_id: str
    name: str
    email: str
    role: str
    is_self: bool
    created_at: datetime


class MemberListResponse(BaseModel):
    workspace_id: str
    items: list[MemberRead]
    total: int


class InviteCreate(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    role: str = Field(default="member")


class InviteRead(BaseModel):
    id: str
    email: str
    role: str
    status: str
    created_at: datetime


class InviteListResponse(BaseModel):
    workspace_id: str
    items: list[InviteRead]
    total: int


class RoleUpdate(BaseModel):
    role: str


def _ctx(db: Session, auth: AuthContext):
    user, workspace, membership = WorkspaceService(db).get_or_create_current_workspace(auth)
    db.commit()
    return user, workspace, membership


def _validate_role(role: str) -> str:
    r = role.strip().lower()
    if r not in _INVITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="role must be admin, member or viewer",
        )
    return r


@router.get("/members")
def list_members(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> MemberListResponse:
    current_user, workspace, _ = _ctx(db, auth)
    rows = db.execute(
        select(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace.id)
        .order_by(WorkspaceMember.created_at)
    ).all()
    items = [
        MemberRead(
            id=m.id,
            user_id=u.id,
            name=u.display_name or (u.email.split("@")[0] if u.email else "Membro"),
            email=u.email,
            role=m.role,
            is_self=u.id == current_user.id,
            created_at=m.created_at,
        )
        for m, u in rows
    ]
    return MemberListResponse(workspace_id=workspace.id, items=items, total=len(items))


@router.get("/invites")
def list_invites(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> InviteListResponse:
    _, workspace, _ = _ctx(db, auth)
    rows = db.scalars(
        select(WorkspaceInvite)
        .where(
            WorkspaceInvite.workspace_id == workspace.id,
            WorkspaceInvite.status == "pending",
        )
        .order_by(WorkspaceInvite.created_at.desc())
    ).all()
    items = [
        InviteRead(id=i.id, email=i.email, role=i.role, status=i.status, created_at=i.created_at)
        for i in rows
    ]
    return InviteListResponse(workspace_id=workspace.id, items=items, total=len(items))


@router.post("/members/invite", status_code=status.HTTP_201_CREATED)
def invite_member(
    payload: InviteCreate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> InviteRead:
    _, workspace, _ = _ctx(db, auth)
    role = _validate_role(payload.role)
    email = payload.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid email"
        )

    # Already a member?
    existing = db.scalar(
        select(WorkspaceMember)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace.id, User.email == email)
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This email is already a member"
        )

    invite = WorkspaceInvite(
        id=str(uuid4()), workspace_id=workspace.id, email=email, role=role, status="pending"
    )
    db.add(invite)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="There is already a pending invite"
        ) from exc
    db.refresh(invite)
    return InviteRead(
        id=invite.id, email=invite.email, role=invite.role, status=invite.status,
        created_at=invite.created_at,
    )


@router.post("/invites/{invite_id}/accept")
def accept_invite(
    invite_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> MemberRead:
    _, workspace, _ = _ctx(db, auth)
    invite = _get_invite(db, workspace.id, invite_id)
    user = db.scalar(select(User).where(User.email == invite.email))
    if user is None:
        user = User(
            id=str(uuid4()),
            supabase_user_id=str(uuid4()),
            email=invite.email,
            display_name=invite.email.split("@")[0],
        )
        db.add(user)
        db.flush()
    member = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace.id, WorkspaceMember.user_id == user.id
        )
    )
    if member is None:
        member = WorkspaceMember(
            id=str(uuid4()), workspace_id=workspace.id, user_id=user.id, role=invite.role
        )
        db.add(member)
    else:
        member.role = invite.role
    db.delete(invite)
    db.commit()
    db.refresh(member)
    return MemberRead(
        id=member.id, user_id=user.id,
        name=user.display_name or user.email.split("@")[0], email=user.email,
        role=member.role, is_self=False, created_at=member.created_at,
    )


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_invite(
    invite_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> None:
    _, workspace, _ = _ctx(db, auth)
    invite = _get_invite(db, workspace.id, invite_id)
    db.delete(invite)
    db.commit()
    return None


@router.patch("/members/{member_id}")
def update_member_role(
    member_id: str,
    payload: RoleUpdate,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> MemberRead:
    current_user, workspace, _ = _ctx(db, auth)
    member = _get_member(db, workspace.id, member_id)
    if member.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The owner role cannot be changed",
        )
    member.role = _validate_role(payload.role)
    db.commit()
    db.refresh(member)
    user = db.get(User, member.user_id)
    return MemberRead(
        id=member.id, user_id=member.user_id,
        name=(user.display_name or user.email.split("@")[0]) if user else "Membro",
        email=user.email if user else "", role=member.role,
        is_self=member.user_id == current_user.id, created_at=member.created_at,
    )


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    member_id: str,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> None:
    _, workspace, _ = _ctx(db, auth)
    member = _get_member(db, workspace.id, member_id)
    if member.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The owner cannot be removed",
        )
    db.delete(member)
    db.commit()
    return None


def _get_member(db: Session, workspace_id: str, member_id: str) -> WorkspaceMember:
    _uuid(member_id, "Invalid member id")
    member = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.id == member_id, WorkspaceMember.workspace_id == workspace_id
        )
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return member


def _get_invite(db: Session, workspace_id: str, invite_id: str) -> WorkspaceInvite:
    _uuid(invite_id, "Invalid invite id")
    invite = db.scalar(
        select(WorkspaceInvite).where(
            WorkspaceInvite.id == invite_id, WorkspaceInvite.workspace_id == workspace_id
        )
    )
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")
    return invite


def _uuid(value: str, message: str) -> None:
    try:
        UUID(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message
        ) from exc
