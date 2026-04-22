from dotenv import load_dotenv
load_dotenv()  # loads .env before any router imports read os.getenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import bureau, eligibility, emi, application, dealer, cars, chat, tts, avatar, sessions, analytics, review

app = FastAPI(
    title="Kotak Gamified Loan Journey API",
    description="Backend for the Kotak Bank showroom kiosk loan system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_methods=["*"],
    allow_headers=["*"]
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
    return {"status": "running", "project": "Kotak Gamified Loan Journey"}


@app.get("/health")
def health():
    return {"status": "ok"}
