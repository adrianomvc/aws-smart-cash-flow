from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import AuthContext, AuthDependency
from app.db.session import get_db
from app.services.copilot_service import CopilotService

router = APIRouter(tags=["copilot"])
DbDependency = Depends(get_db)


class CopilotTurn(BaseModel):
    role: str
    content: str


class CopilotChatRequest(BaseModel):
    message: str
    history: list[CopilotTurn] = []


class CopilotChatResponse(BaseModel):
    reply: str | None
    available: bool


@router.get("/copilot/status")
def copilot_status(
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> dict:
    return {"available": CopilotService(db).available()}


@router.post("/copilot/chat")
def copilot_chat(
    payload: CopilotChatRequest,
    auth: AuthContext = AuthDependency,
    db: Session = DbDependency,
) -> CopilotChatResponse:
    result = CopilotService(db).answer(
        workspace_id=auth.workspace_id,
        message=payload.message,
        history=[turn.model_dump() for turn in payload.history],
    )
    return CopilotChatResponse(reply=result.get("reply"), available=bool(result.get("available")))
