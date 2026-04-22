"""
Analytics over kiosk sessions. Read-only queries over sessions_cache.
"""
from collections import Counter
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from routers.sessions import sessions_cache

router = APIRouter(prefix="/analytics", tags=["Analytics"])

STAGE_ORDER = [
    "idle",
    "car_catalog",
    "financial_discovery",
    "eligibility_teaser",
    "pan_entry",
    "eligibility_result",
    "emi_optimizer",
    "phone_capture",
    "application_review",
    "waiting",
    "celebration",
]

STAGE_LABELS = {
    "idle":                "Arrived",
    "car_catalog":         "Browsed cars",
    "financial_discovery": "Answered questions",
    "eligibility_teaser":  "Saw teaser",
    "pan_entry":           "Entered PAN",
    "eligibility_result":  "Got pre-approval",
    "emi_optimizer":       "Tuned EMI",
    "phone_capture":       "Shared phone",
    "application_review":  "Reviewed app",
    "waiting":             "Submitted",
    "celebration":         "Completed",
}


def _stages_reached(session: dict) -> set[str]:
    reached = {e.get("stage") for e in session.get("events", []) if e.get("stage")}
    reached.add(session.get("current_stage", "idle"))
    return reached


@router.get("/overview")
def overview():
    all_sessions = list(sessions_cache.values())
    total = len(all_sessions)

    # Active = last_seen within 5 minutes and status=active
    cutoff = datetime.now() - timedelta(minutes=5)
    def is_live(s):
        try:
            return s.get("status") == "active" and datetime.fromisoformat(s.get("last_seen_at", "")) > cutoff
        except Exception:
            return False

    active    = sum(1 for s in all_sessions if is_live(s))
    completed = sum(1 for s in all_sessions if s.get("status") == "completed")
    dropped   = sum(1 for s in all_sessions if s.get("status") == "dropped")
    stale     = total - active - completed - dropped

    # Funnel: how many sessions reached each stage at least once
    reached_counts = Counter()
    for s in all_sessions:
        for st in _stages_reached(s):
            reached_counts[st] += 1

    funnel = [
        {
            "stage": st,
            "label": STAGE_LABELS.get(st, st),
            "count": reached_counts[st],
            "conversion": round(reached_counts[st] / total, 3) if total else 0.0,
        }
        for st in STAGE_ORDER
    ]

    # Drop-off hotspot: which stage did dropped sessions end on
    dropoff_counts = Counter()
    for s in all_sessions:
        if s.get("status") == "dropped":
            dropoff_counts[s.get("current_stage", "idle")] += 1
    hotspot = None
    if dropoff_counts:
        stage, count = dropoff_counts.most_common(1)[0]
        hotspot = {
            "stage": stage,
            "label": STAGE_LABELS.get(stage, stage),
            "count": count,
            "pct": round(count / max(total, 1) * 100, 1),
        }

    # Popular cars
    car_counts = Counter()
    for s in all_sessions:
        car = (s.get("snapshot") or {}).get("car")
        if car:
            label = f"{car.get('brand','')} {car.get('model','')}".strip()
            if label:
                car_counts[label] += 1
    popular_cars = [{"car": c, "count": n} for c, n in car_counts.most_common(5)]

    # Avg time on kiosk (completed + dropped)
    durations = []
    for s in all_sessions:
        try:
            start = datetime.fromisoformat(s["started_at"])
            end = datetime.fromisoformat(s["last_seen_at"])
            durations.append((end - start).total_seconds())
        except Exception:
            pass
    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0

    return {
        "total_sessions":  total,
        "active":          active,
        "completed":       completed,
        "dropped":         dropped,
        "stale":           stale,
        "conversion_rate": round(completed / total, 3) if total else 0.0,
        "avg_duration_sec": avg_duration,
        "funnel":          funnel,
        "dropoff_hotspot": hotspot,
        "popular_cars":    popular_cars,
    }


@router.get("/sessions")
def list_sessions(limit: int = 100, status: str | None = None):
    items = list(sessions_cache.values())
    if status:
        items = [s for s in items if s.get("status") == status]
    items.sort(key=lambda s: s.get("started_at", ""), reverse=True)
    items = items[:limit]

    return [
        {
            "session_id":     s["session_id"],
            "started_at":     s["started_at"],
            "last_seen_at":   s["last_seen_at"],
            "current_stage":  s["current_stage"],
            "current_label":  STAGE_LABELS.get(s["current_stage"], s["current_stage"]),
            "status":         s["status"],
            "phone":          s.get("phone"),
            "application_id": s.get("application_id"),
            "car":            (s.get("snapshot") or {}).get("car"),
            "eligibility":    (s.get("snapshot") or {}).get("eligibility"),
            "events_count":   len(s.get("events", [])),
        }
        for s in items
    ]


@router.get("/session/{sid}")
def session_detail(sid: str):
    if sid not in sessions_cache:
        raise HTTPException(status_code=404, detail="Session not found")
    s = sessions_cache[sid]
    enriched_events = [
        {**e, "label": STAGE_LABELS.get(e.get("stage", ""), e.get("stage", ""))}
        for e in s.get("events", [])
    ]
    return {**s, "events": enriched_events}


@router.get("/insights")
def insights():
    """
    Narrative insights. Template-based for now — replace with LLM call later.
    """
    data = overview()
    bullets: list[str] = []

    if data["total_sessions"] == 0:
        bullets.append("No sessions yet — waiting for first kiosk visitor.")
        return {"bullets": bullets}

    cr_pct = round(data["conversion_rate"] * 100, 1)
    bullets.append(
        f"Conversion: {cr_pct}% ({data['completed']} of {data['total_sessions']} sessions completed)."
    )

    if data["dropoff_hotspot"]:
        h = data["dropoff_hotspot"]
        bullets.append(
            f"Biggest drop-off: {h['label']} — {h['count']} left here ({h['pct']}% of all sessions)."
        )

    if data["popular_cars"]:
        top = data["popular_cars"][0]
        bullets.append(f"Most picked: {top['car']} — {top['count']} customers selected it.")

    if data["avg_duration_sec"] > 0:
        mins = round(data["avg_duration_sec"] / 60, 1)
        bullets.append(f"Average time on kiosk: {mins} minutes per customer.")

    return {"bullets": bullets}
