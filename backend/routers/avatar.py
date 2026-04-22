"""
Azure Real-Time Text-to-Speech Avatar — WebRTC integration.

The browser establishes a WebRTC peer connection directly with Azure's avatar
service. The backend's only job is to:

  1. Mint a short-lived authorization token (so the raw subscription key
     never leaves the server).
  2. Fetch the WebRTC ICE (TURN) server credentials from Azure and forward
     them to the browser.

Both endpoints are safe to call repeatedly; tokens are valid for ~10 minutes.

Supported regions for Avatar: westus2, westeurope, southeastasia.
Requires Standard S0 pricing tier (not F0 free tier).
"""
import os
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/avatar", tags=["Avatar"])

AVATAR_KEY    = os.getenv("AZURE_AVATAR_KEY", "")
AVATAR_REGION = os.getenv("AZURE_AVATAR_REGION", "southeastasia")

SUPPORTED_REGIONS = {"westus2", "westeurope", "southeastasia"}


def _ensure_configured() -> None:
    if not AVATAR_KEY:
        raise HTTPException(
            status_code=503,
            detail="Avatar not configured — AZURE_AVATAR_KEY missing",
        )
    if AVATAR_REGION not in SUPPORTED_REGIONS:
        raise HTTPException(
            status_code=503,
            detail=f"Region '{AVATAR_REGION}' not supported for Avatar. Use one of: {sorted(SUPPORTED_REGIONS)}",
        )


@router.get("/config")
def config():
    """Public — tells the kiosk whether avatar is available."""
    return {
        "configured": bool(AVATAR_KEY) and AVATAR_REGION in SUPPORTED_REGIONS,
        "region": AVATAR_REGION,
    }


@router.get("/session")
async def get_auth_token():
    """
    Returns a short-lived (~10 min) authorization token + region.
    The browser passes this to SpeechConfig.fromAuthorizationToken() so the
    real subscription key stays server-side.
    """
    _ensure_configured()
    url = f"https://{AVATAR_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                url, headers={"Ocp-Apim-Subscription-Key": AVATAR_KEY}
            )
            res.raise_for_status()
            return {"token": res.text, "region": AVATAR_REGION}
    except httpx.HTTPStatusError as e:
        return JSONResponse(
            {"error": "token_failed", "status": e.response.status_code, "body": e.response.text[:200]},
            status_code=502,
        )
    except Exception as e:
        return JSONResponse({"error": "unexpected", "message": str(e)}, status_code=502)


@router.get("/ice")
async def get_ice_config():
    """
    Fetches Azure's WebRTC ICE (TURN) server credentials for the avatar
    relay. Valid ~1 minute. Call this right before starting the peer
    connection each session.
    """
    _ensure_configured()
    url = f"https://{AVATAR_REGION}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.get(
                url, headers={"Ocp-Apim-Subscription-Key": AVATAR_KEY}
            )
            res.raise_for_status()
            data = res.json()
            # Normalise for the browser side
            return {
                "urls":     data.get("Urls", []),
                "username": data.get("Username", ""),
                "credential": data.get("Password", ""),
            }
    except httpx.HTTPStatusError as e:
        return JSONResponse(
            {"error": "ice_failed", "status": e.response.status_code, "body": e.response.text[:200]},
            status_code=502,
        )
    except Exception as e:
        return JSONResponse({"error": "unexpected", "message": str(e)}, status_code=502)
