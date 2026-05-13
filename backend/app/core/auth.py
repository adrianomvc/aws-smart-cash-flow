from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status

LOCAL_USER_ID = "00000000-0000-0000-0000-000000000001"
LOCAL_WORKSPACE_ID = "00000000-0000-0000-0000-000000000002"


@dataclass(frozen=True)
class AuthContext:
    user_id: str
    workspace_id: str


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

    return AuthContext(user_id=LOCAL_USER_ID, workspace_id=LOCAL_WORKSPACE_ID)


AuthDependency = Depends(get_auth_context)
