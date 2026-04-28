import os
from dotenv import load_dotenv
load_dotenv()  # loads .env before any router imports read os.getenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import bureau, eligibility, emi, application, dealer, cars, chat, tts, avatar, sessions, analytics, review

app = FastAPI(
    title="Car Loan Kiosk API",
    description="Backend for the showroom car-loan kiosk — agentic AI demo",
    version="1.0.0"
)

# CORS — driven by env var so we can add CloudFront URLs without code changes.
# Comma-separated list, e.g. "https://d123.cloudfront.net,https://d456.cloudfront.net"
# Defaults to "*" for dev / open-access; lock down in production by setting ALLOWED_ORIGINS.
_origins_env = os.getenv("ALLOWED_ORIGINS", "*").strip()
if _origins_env == "*":
    allow_origins = ["*"]
    allow_origin_regex = None
else:
    allow_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
    # Allow any *.cloudfront.net by default so previews work, plus the explicit list above
    allow_origin_regex = r"^https://[a-z0-9-]+\.cloudfront\.net$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=allow_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

app.include_router(cars.router)
app.include_router(bureau.router)
app.include_router(eligibility.router)
app.include_router(emi.router)
app.include_router(application.router)
app.include_router(dealer.router)
app.include_router(chat.router)
app.include_router(tts.router)
app.include_router(avatar.router)
app.include_router(sessions.router)
app.include_router(analytics.router)
app.include_router(review.router)


@app.get("/")
def root():
    return {"status": "running", "project": "Car Loan Kiosk"}


@app.get("/health")
def health():
    return {"status": "ok"}
