"""
Azure Talking Avatar — full video avatar with lip-sync.
Uses Azure Batch Synthesis API (3.1-preview1).

Supported regions: westus2, westeurope, southeastasia ONLY.
Avatar character: "lisa" (professional female) with casual-sitting style.

Strategy for kiosk:
  1. POST /avatar/warmup on startup — generates all 11 stage videos in background
  2. GET /avatar/message/{stage} — instant cached response during demo
  3. POST /avatar/speak — on-demand fallback for uncached text
"""
import os
import asyncio
import httpx
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/avatar", tags=["Avatar"])

AZURE_KEY    = os.getenv("AZURE_SPEECH_KEY", "")
AZURE_REGION = os.getenv("AZURE_SPEECH_REGION", "westus2")

AVATAR_API = (
    f"https://{AZURE_REGION}.customvoice.api.speech.microsoft.com"
    f"/api/texttospeech/3.1-preview1/batchsynthesis/talkingavatar"
)

SUPPORTED_REGIONS = {"westus2", "westeurope", "southeastasia"}

STAGE_MESSAGES: dict[str, str] = {
    "idle":                "Welcome to Kotak Bank! Tap anywhere to start your car loan journey.",
    "car_catalog":         "Browse our catalog and tap the car you would love to drive home today!",
    "financial_discovery": "Let me understand your budget. I will find the perfect loan for you.",
    "eligibility_teaser":  "You are just one step away from seeing your personalized pre-approval!",
    "pan_entry":           "Your PAN is used only to check your credit profile. It is fully secure.",
    "eligibility_result":  "Congratulations! You have been pre-approved. Here are your loan details.",
    "emi_optimizer":       "Adjust the sliders to find your perfect monthly payment.",
    "phone_capture":       "Almost done! Share your number to receive your loan summary.",
    "application_review":  "Everything looks great. Review and submit when you are ready.",
    "waiting":             "Processing your application. This takes just a few seconds.",
    "celebration":         "Your loan is approved! Welcome to the Kotak family!",
}

# In-memory cache: stage → video_url (Azure CDN URL, valid ~24h)
_cache: dict[str, str] = {}
_warmup_done = False


def _headers() -> dict:
    return {
        "Ocp-Apim-Subscription-Key": AZURE_KEY,
        "Content-Type": "application/json",
    }


def _avatar_payload(text: str, voice: str = "en-IN-NeerjaNeural") -> dict:
    return {
        "synthesisConfig": {"voice": voice},
        "inputKind": "PlainText",
        "inputs": [{"content": text}],
        "avatarConfig": {
            "talkingAvatarCharacter": "lisa",
            "talkingAvatarStyle": "casual-sitting",
            "videoFormat": "webm",
            "videoCodec": "vp9",
            "subtitleType": "soft_embedded",
            "backgroundColor": "#00000000",
        },
    }


async def _submit_job(text: str, voice: str = "en-IN-NeerjaNeural") -> str | None:
    """Submit a batch synthesis job. Returns job_id or None on error."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                AVATAR_API,
                json=_avatar_payload(text, voice),
                headers=_headers(),
            )
            res.raise_for_status()
            return res.json().get("id")
    except Exception as e:
        print(f"[Avatar] Submit failed: {e}")
        return None


async def _poll_job(job_id: str, max_seconds: int = 180) -> str | None:
    """Poll until Succeeded or timeout. Returns video_url or None."""
    url = f"{AVATAR_API}/{job_id}"
    tries = max_seconds // 5
    async with httpx.AsyncClient(timeout=10) as client:
        for _ in range(tries):
            await asyncio.sleep(5)
            try:
                res = await client.get(url, headers=_headers())
                data = res.json()
                status = data.get("status", "")
                if status == "Succeeded":
                    return data.get("outputs", {}).get("result")
                if status in ("Failed", "Canceled"):
                    print(f"[Avatar] Job {job_id} ended with status: {status}")
                    return None
            except Exception as e:
                print(f"[Avatar] Poll error: {e}")
    print(f"[Avatar] Job {job_id} timed out after {max_seconds}s")
    return None


async def _generate_and_cache(stage: str, text: str) -> bool:
    """Generate avatar video for one stage and cache it."""
    job_id = await _submit_job(text)
    if not job_id:
        return False
    video_url = await _poll_job(job_id)
    if video_url:
        _cache[stage] = video_url
        print(f"[Avatar] Cached: {stage}")
        return True
    return False


async def _warmup_all():
    """Background task: pre-generate all stage videos."""
    global _warmup_done
    if not AZURE_KEY:
        print("[Avatar] No Azure key — skipping warmup.")
        return
    if AZURE_REGION not in SUPPORTED_REGIONS:
        print(f"[Avatar] Region '{AZURE_REGION}' not supported for Talking Avatar. Use: {SUPPORTED_REGIONS}")
        return

    print("[Avatar] Starting warmup — generating all stage videos...")
    tasks = [
        _generate_and_cache(stage, text)
        for stage, text in STAGE_MESSAGES.items()
        if stage not in _cache
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    ok = sum(1 for r in results if r is True)
    print(f"[Avatar] Warmup complete: {ok}/{len(STAGE_MESSAGES)} videos cached.")
    _warmup_done = True


# ── Routes ──────────────────────────────────────────────────────────────────

@router.post("/warmup")
async def warmup(background_tasks: BackgroundTasks):
    """
    Pre-generate all 11 stage videos in background.
    Call once after backend starts. Videos are cached for the session.
    """
    if not AZURE_KEY:
        return {"status": "skipped", "reason": "AZURE_SPEECH_KEY not set"}
    if AZURE_REGION not in SUPPORTED_REGIONS:
        return {
            "status": "skipped",
            "reason": f"Region '{AZURE_REGION}' not supported. Use one of: {sorted(SUPPORTED_REGIONS)}",
        }
    background_tasks.add_task(_warmup_all)
    return {"status": "started", "stages": list(STAGE_MESSAGES.keys())}


@router.get("/status")
def warmup_status():
    """Check which stages are cached."""
    return {
        "azure_configured": bool(AZURE_KEY),
        "region": AZURE_REGION,
        "region_supported": AZURE_REGION in SUPPORTED_REGIONS,
        "warmup_done": _warmup_done,
        "cached_stages": list(_cache.keys()),
        "total_stages": len(STAGE_MESSAGES),
    }


@router.get("/message/{stage}")
async def get_stage_video(stage: str, background_tasks: BackgroundTasks):
    """
    Return cached video URL for a stage.
    If not cached yet, triggers generation in background and returns null.
    """
    if not AZURE_KEY:
        return {"video_url": None, "cached": False, "reason": "no_key"}

    if stage in _cache:
        return {"video_url": _cache[stage], "cached": True}

    # Not cached — trigger background generation if valid stage
    if stage in STAGE_MESSAGES and AZURE_REGION in SUPPORTED_REGIONS:
        background_tasks.add_task(_generate_and_cache, stage, STAGE_MESSAGES[stage])

    return {"video_url": None, "cached": False, "reason": "generating"}


class SpeakRequest(BaseModel):
    text: str
    voice: str = "en-IN-NeerjaNeural"


@router.post("/speak")
async def speak_custom(req: SpeakRequest):
    """
    On-demand: generate avatar video for arbitrary text.
    Waits synchronously (30-180s). Use /warmup for known messages.
    """
    if not AZURE_KEY:
        return JSONResponse({"error": "no_key", "message": "AZURE_SPEECH_KEY not set"})
    if AZURE_REGION not in SUPPORTED_REGIONS:
        return JSONResponse({"error": "bad_region", "message": f"Use region: {sorted(SUPPORTED_REGIONS)}"})

    job_id = await _submit_job(req.text, req.voice)
    if not job_id:
        return JSONResponse({"error": "submit_failed"}, status_code=502)

    video_url = await _poll_job(job_id)
    if not video_url:
        return JSONResponse({"error": "generation_failed"}, status_code=502)

    return {"video_url": video_url}
