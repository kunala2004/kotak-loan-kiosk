"""
Endpoints that drive the LangGraph review.

  POST /review/start/{application_id}   — kicks off, runs until first interrupt
  POST /review/resume/{application_id}  — {value: "123456"} resumes the graph
  GET  /review/state/{application_id}   — current state (for UI polling)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from langgraph.types import Command
from agents.review_graph import REVIEW_GRAPH
from routers.application import applications

router = APIRouter(prefix="/review", tags=["Agentic Review"])


def _thread(app_id: str) -> dict:
    return {"configurable": {"thread_id": f"review_{app_id}"}}


def _read_state(app_id: str) -> dict:
    snap = REVIEW_GRAPH.get_state(_thread(app_id))
    values = snap.values or {}

    # LangGraph 1.x: interrupts live on each pending task in `snap.tasks`,
    # not on `snap.interrupts`. Walk all tasks and collect them.
    interrupts: list = []
    for task in (getattr(snap, "tasks", None) or []):
        for itr in (getattr(task, "interrupts", None) or []):
            interrupts.append(itr)
    # Some older versions still expose top-level .interrupts — fall back to it.
    if not interrupts:
        for itr in (getattr(snap, "interrupts", None) or []):
            interrupts.append(itr)

    waiting_payload = None
    if interrupts:
        first = interrupts[0]
        # Interrupt object has .value; handle dict / raw payload variants too
        if hasattr(first, "value"):
            waiting_payload = first.value
        elif isinstance(first, dict):
            waiting_payload = first

    status = values.get("status", "running")
    if waiting_payload:
        status = "waiting"

    return {
        "application_id": app_id,
        "status":         status,
        "waiting_for":    (waiting_payload or {}).get("waiting_for") if waiting_payload else None,
        "prompt":         (waiting_payload or {}).get("prompt")      if waiting_payload else None,
        "demo_hint":      (waiting_payload or {}).get("demo_hint")   if waiting_payload else None,
        "events":         values.get("events", []),
        "docs":           values.get("docs", {}),
        "verification":   values.get("verification"),
        "recommendation": values.get("recommendation"),
        "brief":          values.get("brief"),
        "brief_template": values.get("brief_template"),
        "brief_meta":     values.get("brief_meta"),
    }


@router.post("/start/{app_id}")
def start_review(app_id: str):
    if app_id not in applications:
        raise HTTPException(status_code=404, detail="Application not found")

    initial = {"application_id": app_id}
    # Invoke — will run to first interrupt and stop
    REVIEW_GRAPH.invoke(initial, _thread(app_id))
    return _read_state(app_id)


class ResumeBody(BaseModel):
    value: str  # OTP / consent code entered by dealer


@router.post("/resume/{app_id}")
def resume_review(app_id: str, body: ResumeBody):
    snap = REVIEW_GRAPH.get_state(_thread(app_id))
    if not snap.values:
        raise HTTPException(status_code=404, detail="No active review — call /review/start first")

    # Resume the interrupted graph with the dealer-provided value
    REVIEW_GRAPH.invoke(Command(resume=body.value), _thread(app_id))
    return _read_state(app_id)


@router.get("/state/{app_id}")
def get_review_state(app_id: str):
    snap = REVIEW_GRAPH.get_state(_thread(app_id))
    if not snap.values:
        return {
            "application_id": app_id,
            "status":         "not_started",
            "events":         [],
        }
    return _read_state(app_id)


@router.post("/reset/{app_id}")
def reset_review(app_id: str):
    """Clear review state for this application — lets dealer restart from scratch."""
    REVIEW_GRAPH.checkpointer.delete_thread(f"review_{app_id}")
    return {"reset": True}
