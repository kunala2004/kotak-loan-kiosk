"""
Kiosk session tracking.

Every kiosk page load creates a session. Every stage transition sends an
event. Dropoffs and completions are marked explicitly. All sessions are
persisted to data/sessions.json so analytics survive a restart.
"""
import json
import uuid
import asyncio
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/session", tags=["Sessions"])

DATA_FILE = Path(__file__).parent.parent / "data" / "sessions.json"
_write_lock = asyncio.Lock()


def _load() -> dict:
    if not DATA_FILE.exists():
        return {}
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_sync(sessions: dict):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(sessions, indent=2, ensure_ascii=False), encoding="utf-8")


# Single in-memory cache, hydrated from disk once at startup.
sessions_cache: dict = _load()


class EventIn(BaseModel):
    session_id: str
    stage: str
    data: dict | None = None


class DropoffIn(BaseModel):
    session_id: str
    phone: str | None = None


class CompleteIn(BaseModel):
    session_id: str
    application_id: str


async def _persist():
    async with _write_lock:
        _save_sync(sessions_cache)


@router.post("/start")
async def start_session():
    sid = f"sess_{uuid.uuid4().hex[:10]}"
    now = datetime.now().isoformat()
    sessions_cache[sid] = {
        "session_id": sid,
        "started_at": now,
        "last_seen_at": now,
        "current_stage": "idle",
        "status": "active",
        "phone": None,
        "application_id": None,
        "snapshot": {},
        "events": [{"stage": "idle", "at": now, "data": {}}],
    }
    await _persist()
    return {"session_id": sid}


@router.post("/event")
async def log_event(body: EventIn):
    s = sessions_cache.get(body.session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now().isoformat()
    s["current_stage"] = body.stage
    s["last_seen_at"] = now

    if body.data:
        s["snapshot"].update(body.data)
        if "phone" in body.data and body.data["phone"]:
            s["phone"] = body.data["phone"]
        if "application_id" in body.data and body.data["application_id"]:
            s["application_id"] = body.data["application_id"]
            s["status"] = "completed"

    if body.stage == "celebration":
        s["status"] = "completed"

    s["events"].append({"stage": body.stage, "at": now, "data": body.data or {}})
    await _persist()
    return {"ok": True, "session": s["session_id"]}


@router.post("/dropoff")
async def dropoff(body: DropoffIn):
    s = sessions_cache.get(body.session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    if s["status"] != "completed":
        s["status"] = "dropped"
    if body.phone:
        s["phone"] = body.phone
    await _persist()
    return {"ok": True}


@router.post("/complete")
async def complete(body: CompleteIn):
    s = sessions_cache.get(body.session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    s["status"] = "completed"
    s["application_id"] = body.application_id
    await _persist()
    return {"ok": True}


@router.get("/{sid}")
def get_session(sid: str):
    if sid not in sessions_cache:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions_cache[sid]
