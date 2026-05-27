from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/auth", tags=["auth"])
DbDependency = Depends(get_db)


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None


class SignupResponse(BaseModel):
    user_id: str
    email: str
    display_name: str | None
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    user_id: str
    email: str
    display_name: str | None


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest,
    db: Session = DbDependency,
) -> SignupResponse:
    """Register a new user using Supabase Auth."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Supabase is not configured. Signup is not available.",
        )

    try:
        from supabase import create_client

        supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

        # Create user in Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": payload.email,
            "password": payload.password,
            "options": {
                "data": {
                    "display_name": payload.display_name or payload.email.split("@")[0]
                }
            }
        })

        if auth_response.user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user in Supabase Auth"
            )

        # Create user in our database
        user_id = str(auth_response.user.id)
        from app.db.models import User
        from app.services.workspace_service import WorkspaceService

        existing_user = db.scalar(select(User).where(User.supabase_user_id == user_id))
        if existing_user:
            # User already exists in our database
            return SignupResponse(
                user_id=existing_user.id,
                email=existing_user.email,
                display_name=existing_user.display_name,
                created_at=existing_user.created_at,
            )

        # Create new user in database
        user = User(
            id=user_id,
            supabase_user_id=user_id,
            email=payload.email,
            display_name=payload.display_name or payload.email.split("@")[0],
        )
        db.add(user)
        db.flush()

        # Create initial workspace
        from app.core.auth import AuthContext

        auth_context = AuthContext(
            user_id=user_id,
            workspace_id=None,
            email=payload.email
        )
        WorkspaceService(db).get_or_create_current_workspace(auth_context)
        db.commit()

        return SignupResponse(
            user_id=user.id,
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at,
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signup failed: {str(e)}"
        ) from e


@router.post("/login")
async def login(
    payload: LoginRequest,
) -> LoginResponse:
    """Login with email and password using Supabase Auth."""
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Supabase is not configured. Login is not available.",
        )

    try:
        from supabase import create_client

        # Use anon key for user login
        supabase = create_client(settings.supabase_url, settings.supabase_anon_key)

        auth_response = supabase.auth.sign_in_with_password({
            "email": payload.email,
            "password": payload.password,
        })

        if auth_response.user is None or auth_response.session is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        return LoginResponse(
            access_token=auth_response.session.access_token,
            refresh_token=auth_response.session.refresh_token,
            user_id=str(auth_response.user.id),
            email=auth_response.user.email or "",
            display_name=auth_response.user.user_metadata.get("display_name"),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        ) from e


@router.post("/refresh")
async def refresh_token(
    refresh_token: str,
) -> LoginResponse:
    """Refresh access token using refresh token."""
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Supabase is not configured. Token refresh is not available.",
        )

    try:
        from supabase import create_client

        supabase = create_client(settings.supabase_url, settings.supabase_anon_key)

        auth_response = supabase.auth.refresh_session(refresh_token)

        if auth_response.session is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token"
            )

        return LoginResponse(
            access_token=auth_response.session.access_token,
            refresh_token=auth_response.session.refresh_token,
            user_id=str(auth_response.user.id) if auth_response.user else "",
            email=auth_response.user.email or "" if auth_response.user else "",
            display_name=auth_response.user.user_metadata.get("display_name") if auth_response.user else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token refresh failed: {str(e)}"
        ) from e


@router.post("/reset-password")
async def reset_password(
    email: EmailStr,
) -> dict[str, str]:
    """Send password reset email."""
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Supabase is not configured. Password reset is not available.",
        )

    try:
        from supabase import create_client

        supabase = create_client(settings.supabase_url, settings.supabase_anon_key)

        supabase.auth.reset_password_email(email)

        return {"message": "Password reset email sent if account exists"}

    except Exception as e:
        # Don't reveal whether email exists for security
        return {"message": "Password reset email sent if account exists"}
