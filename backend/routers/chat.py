from fastapi import APIRouter
from pydantic import BaseModel
from agents.kiosk_agent import run_kiosk_agent

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    message: str
    session_data: dict
    current_stage: str
    message_history: list = []


@router.post("/message")
def chat(req: ChatRequest):
    """
    Freeform customer input → LangGraph kiosk agent → Priya's response.
    Only called when customer speaks/types freeform, not when they tap UI elements.
    """
    result = run_kiosk_agent(
        user_message=req.message,
        session_data=req.session_data,
        current_stage=req.current_stage,
        message_history=req.message_history
    )
    return {
        "response": result["response"],
        "extracted_data": result["extracted_data"]
    }
