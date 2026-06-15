import json
import time
import urllib.request
from dataclasses import dataclass, replace

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

LOCAL_USER_ID = "00000000-0000-0000-0000-000000000001"
LOCAL_WORKSPACE_ID = "00000000-0000-0000-0000-000000000002"

# Cached Cognito JWKS keys per user pool (refreshed hourly / on key rotation).
_JWKS_CACHE: dict[str, tuple[list[dict], float]] = {}
_JWKS_TTL_SECONDS = 3600

# Cache the resolved workspace per user so identity-provider requests don't hit
# the DB to resolve the workspace on every single call.
_WS_CACHE: dict[str, tuple[str, float]] = {}
_WS_TTL_SECONDS = 300


@dataclass(frozen=True)
class AuthContext:
    user_id: str
    workspace_id: str | None
    email: str | None = None
    name: str | None = None


def _cognito_jwks(*, force_refresh: bool = False) -> list[dict]:
    url = (
        f"https://cognito-idp.{settings.cognito_region}.amazonaws.com/"
        f"{settings.cognito_user_pool_id}/.well-known/jwks.json"
    )
    cached = _JWKS_CACHE.get(url)
    if not force_refresh and cached and (time.time() - cached[1]) < _JWKS_TTL_SECONDS:
        return cached[0]
    with urllib.request.urlopen(url, timeout=5) as response:  # noqa: S310 - fixed AWS host
        keys = json.loads(response.read()).get("keys", [])
    _JWKS_CACHE[url] = (keys, time.time())
    return keys


def _verify_cognito_token(token: str) -> AuthContext:
    issuer = (
        f"https://cognito-idp.{settings.cognito_region}.amazonaws.com/"
        f"{settings.cognito_user_pool_id}"
    )
    try:
        kid = jwt.get_unverified_header(token).get("kid")
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc

    key = next((k for k in _cognito_jwks() if k.get("kid") == kid), None)
    if key is None:
        key = next((k for k in _cognito_jwks(force_refresh=True) if k.get("kid") == kid), None)
    if key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown signing key"
        )

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=settings.cognito_app_client_id,
            issuer=issuer,
            options={"verify_exp": True, "verify_aud": True},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        ) from exc

    user_id = claims.get("sub")
    email = claims.get("email")
    name = claims.get("name") or claims.get("given_name")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token claims"
        )
    return AuthContext(user_id=user_id, workspace_id=None, email=email, name=name)


async def _authenticate(authorization: str | None) -> AuthContext:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if token == "local-dev":
        if settings.app_env == "local":
            return AuthContext(
                user_id=LOCAL_USER_ID,
                workspace_id=LOCAL_WORKSPACE_ID,
                email="local@example.invalid",
            )
        if settings.allow_local_auth:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Local authentication is not allowed outside local environment",
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if settings.cognito_user_pool_id and settings.cognito_region:
        return _verify_cognito_token(token)

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


_DbDependency = Depends(get_db)


async def get_auth_context(
    authorization: str | None = Header(default=None),
    db: Session = _DbDependency,
) -> AuthContext:
    ctx = await _authenticate(authorization)
    # For identity-provider auth (Cognito/Supabase) the token has no workspace;
    # resolve (and create on first sign-in) the user's workspace so every data
    # route is scoped correctly. Cached per user to avoid a DB round-trip on
    # every request.
    if ctx.workspace_id is None:
        cached = _WS_CACHE.get(ctx.user_id)
        if cached is not None and (time.time() - cached[1]) < _WS_TTL_SECONDS:
            return replace(ctx, workspace_id=cached[0])

        from app.services.workspace_service import WorkspaceService

        _, workspace, _ = WorkspaceService(db).get_or_create_current_workspace(ctx)
        db.commit()
        _WS_CACHE[ctx.user_id] = (workspace.id, time.time())
        ctx = replace(ctx, workspace_id=workspace.id)
    return ctx


AuthDependency = Depends(get_auth_context)
