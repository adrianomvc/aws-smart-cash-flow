from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings

LOCAL_USER_ID = "00000000-0000-0000-0000-000000000001"
LOCAL_WORKSPACE_ID = "00000000-0000-0000-0000-000000000002"


@dataclass(frozen=True)
class AuthContext:
    user_id: str
    workspace_id: str | None
    email: str | None = None


async def get_auth_context(authorization: str | None = Header(default=None)) -> AuthContext:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Local auth is only allowed when explicitly enabled in local environment.
    if settings.allow_local_auth:
        if settings.app_env != "local":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Local authentication is not allowed outside local environment",
            )

        if token == "local-dev":
            return AuthContext(
                user_id=LOCAL_USER_ID,
                workspace_id=LOCAL_WORKSPACE_ID,
                email="local@example.invalid",
            )

    if settings.supabase_jwt_secret:
        try:
            claims = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={
                    "verify_exp": True,
                    "verify_aud": True,
                },
            )
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            ) from exc

        user_id = claims.get("sub")
        email = claims.get("email")
        if not user_id or not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token claims",
            )

        return AuthContext(
            user_id=user_id,
            workspace_id=None,
            email=email,
        )

    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase Auth is not configured",
        )

    try:
        from supabase import create_client

        supabase = create_client(settings.supabase_url, settings.supabase_anon_key)
        user_response = supabase.auth.get_user(token)

        user = user_response.user
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        return AuthContext(
            user_id=str(user.id),
            workspace_id=None,
            email=user.email,
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(exc)}",
        ) from exc

AuthDependency = Depends(get_auth_context)
