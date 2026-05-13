from fastapi import APIRouter
from pydantic import BaseModel

from app.core.auth import AuthContext, AuthDependency

router = APIRouter(prefix="/transactions", tags=["transactions"])


class CategoryPatch(BaseModel):
    category_id: str


@router.get("")
async def list_transactions(auth: AuthContext = AuthDependency) -> dict[str, object]:
    return {"workspace_id": auth.workspace_id, "items": []}


@router.patch("/{transaction_id}/category")
async def update_transaction_category(
    transaction_id: str,
    payload: CategoryPatch,
    auth: AuthContext = AuthDependency,
) -> dict[str, object]:
    return {
        "workspace_id": auth.workspace_id,
        "transaction_id": transaction_id,
        "category_id": payload.category_id,
    }
