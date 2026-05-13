from fastapi import APIRouter
from pydantic import BaseModel

from app.core.auth import AuthContext, AuthDependency

router = APIRouter(tags=["categories"])


class CategoryCreate(BaseModel):
    name: str
    parent_category_id: str | None = None


class CategorizationRuleCreate(BaseModel):
    name: str
    field: str
    match_type: str
    pattern: str
    category_id: str
    priority: int = 100
    active: bool = True


@router.get("/categories")
async def list_categories(auth: AuthContext = AuthDependency) -> dict[str, object]:
    return {"workspace_id": auth.workspace_id, "items": []}


@router.post("/categories")
async def create_category(
    payload: CategoryCreate,
    auth: AuthContext = AuthDependency,
) -> dict[str, object]:
    return {"workspace_id": auth.workspace_id, **payload.model_dump()}


@router.get("/categorization-rules")
async def list_rules(auth: AuthContext = AuthDependency) -> dict[str, object]:
    return {"workspace_id": auth.workspace_id, "items": []}


@router.post("/categorization-rules")
async def create_rule(
    payload: CategorizationRuleCreate,
    auth: AuthContext = AuthDependency,
) -> dict[str, object]:
    return {"workspace_id": auth.workspace_id, **payload.model_dump()}


@router.post("/categorization-rules/apply")
async def apply_rules(auth: AuthContext = AuthDependency) -> dict[str, object]:
    return {"workspace_id": auth.workspace_id, "status": "queued"}
