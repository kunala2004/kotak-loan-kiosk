"""
Provider-agnostic TTS endpoint.

Switch provider via env: TTS_PROVIDER = mock | elevenlabs | azure

  mock       → returns JSON {mock: true, text}; frontend falls back to
               browser Web Speech API (dev-friendly, no API key needed).
  elevenlabs → real ElevenLabs call, returns audio/mpeg.
  azure      → Azure Neural TTS (Neerja — en-IN female), returns audio/mpeg.

Audio is cached on disk by text hash so we don't re-synth the same line twice.
"""
import os
import hashlib
from pathlib import Path
import httpx
from fastapi import APIRouter
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/tts", tags=["TTS"])

ENV_PROVIDER = os.getenv("TTS_PROVIDER", "mock").lower()
_runtime_override: str | None = None  # set via POST /tts/provider at runtime

VALID_PROVIDERS = {"mock", "elevenlabs", "azure"}


def _active_provider() -> str:
    return _runtime_override if _runtime_override else ENV_PROVIDER

# ElevenLabs
ELEVEN_KEY      = os.getenv("ELEVENLABS_API_KEY", "")
# Default = Rachel (widely available). Swap to any Indian-English female voice ID
# from the ElevenLabs Voice Library by setting ELEVENLABS_VOICE_ID in .env.
ELEVEN_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
ELEVEN_MODEL    = os.getenv("ELEVENLABS_MODEL", "eleven_turbo_v2_5")

# Azure
AZURE_KEY    = os.getenv("AZURE_SPEECH_KEY", "")
AZURE_REGION = os.getenv("AZURE_SPEECH_REGION", "eastus")

CACHE_DIR = Path(__file__).parent.parent / "cache" / "tts"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


class TTSRequest(BaseModel):
    text: str


def _cache_path(prefix: str, text: str) -> Path:
    digest = hashlib.sha256(f"{prefix}:{text}".encode()).hexdigest()[:16]
    return CACHE_DIR / f"{prefix}_{digest}.mp3"


# ── ElevenLabs ───────────────────────────────────────────────────────────
async def _elevenlabs(text: str) -> bytes | None:
    if not ELEVEN_KEY:
        return None
    cache = _cache_path(f"el_{ELEVEN_VOICE_ID[:8]}", text)
    if cache.exists():
        return cache.read_bytes()

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVEN_VOICE_ID}"
    payload = {
        "text": text,
        "model_id": ELEVEN_MODEL,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.8,
            "style": 0.3,
            "use_speaker_boost": True,
        },
    }
    headers = {
        "xi-api-key": ELEVEN_KEY,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(url, json=payload, headers=headers)
            res.raise_for_status()
            cache.write_bytes(res.content)
            return res.content
    except Exception as e:
        print(f"[TTS][ElevenLabs] {e}")
        return None


# ── Azure Neural TTS ─────────────────────────────────────────────────────
async def _azure(text: str, voice: str = "en-IN-NeerjaNeural") -> bytes | None:
    if not AZURE_KEY:
        return None
    cache = _cache_path("az", text)
    if cache.exists():
        return cache.read_bytes()

    token_url = f"https://{AZURE_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    tts_url   = f"https://{AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
    ssml = (
        f"<speak version='1.0' xml:lang='en-IN'>"
        f"<voice xml:lang='en-IN' xml:gender='Female' name='{voice}'>"
        f"<prosody rate='5%' pitch='5%'>{text}</prosody>"
        f"</voice></speak>"
    )
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_res = await client.post(
                token_url, headers={"Ocp-Apim-Subscription-Key": AZURE_KEY}
            )
            token_res.raise_for_status()
            audio_res = await client.post(
                tts_url,
                headers={
                    "Authorization": f"Bearer {token_res.text}",
                    "Content-Type": "application/ssml+xml",
                    "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
                    "User-Agent": "CarLoanKiosk",
                },
                content=ssml.encode("utf-8"),
            )
            audio_res.raise_for_status()
            cache.write_bytes(audio_res.content)
            return audio_res.content
    except Exception as e:
        print(f"[TTS][Azure] {e}")
        return None


# ── Route ────────────────────────────────────────────────────────────────
@router.post("")
async def synthesize(req: TTSRequest):
    provider = _active_provider()

    if provider == "elevenlabs":
        audio = await _elevenlabs(req.text)
        if audio:
            return Response(
                content=audio,
                media_type="audio/mpeg",
                headers={"Cache-Control": "public, max-age=3600"},
            )
        return JSONResponse(
            {"mock": True, "provider": "elevenlabs_fallback", "text": req.text},
            status_code=200,
        )

    if provider == "azure":
        audio = await _azure(req.text)
        if audio:
            return Response(
                content=audio,
                media_type="audio/mpeg",
                headers={"Cache-Control": "public, max-age=3600"},
            )
        return JSONResponse(
            {"mock": True, "provider": "azure_fallback", "text": req.text},
            status_code=200,
        )

    # mock — frontend uses browser Web Speech API
    return JSONResponse(
        {"mock": True, "provider": "mock", "text": req.text},
        status_code=200,
    )


class ProviderUpdate(BaseModel):
    provider: str


@router.post("/provider")
def set_provider(body: ProviderUpdate):
    """Runtime override — lets the kiosk toggle ElevenLabs ON/OFF without restart."""
    global _runtime_override
    p = body.provider.lower().strip()
    if p not in VALID_PROVIDERS:
        return JSONResponse(
            {"error": "invalid_provider", "valid": sorted(VALID_PROVIDERS)},
            status_code=400,
        )
    _runtime_override = p
    return {"active": _active_provider(), "override": _runtime_override, "env_default": ENV_PROVIDER}


@router.get("/config")
def tts_config():
    """Expose active provider — used by the 'i' info panel and the kiosk TTS toggle."""
    active = _active_provider()
    return {
        "provider": active,
        "override": _runtime_override,
        "env_default": ENV_PROVIDER,
        "elevenlabs_configured": bool(ELEVEN_KEY),
        "azure_configured": bool(AZURE_KEY),
        "voice_id": ELEVEN_VOICE_ID if active == "elevenlabs" else None,
    }
