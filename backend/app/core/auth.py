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

    # Development scaffold only. Supabase JWT validation is a release gate before deploy.
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Local auth is only allowed in development environment
    if settings.app_env == "local" and not settings.supabase_jwt_secret:
        return AuthContext(
            user_id=LOCAL_USER_ID,
            workspace_id=LOCAL_WORKSPACE_ID,
            email="local@example.invalid",
        )

    # Block local auth in production environments
    if settings.app_env != "local" and settings.allow_local_auth:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Local authentication is not allowed in production environment",
        )

    if settings.allow_local_auth and token == "local-dev":
        return AuthContext(
            user_id=LOCAL_USER_ID,
            workspace_id=LOCAL_WORKSPACE_ID,
            email="local@example.invalid",
        )

    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase JWT secret not configured",
        )

    try:
        claims = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={
                "verify_exp": True,
                "verify_aud": True,
            }
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )

    email = claims.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing email",
        )

    return AuthContext(
        user_id=user_id,
        workspace_id=None,
        email=email,
    )


AuthDependency = Depends(get_auth_context)
