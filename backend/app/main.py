"""
Market Diagnosis Platform — FastAPI App
10 Modules | User + Admin Auth | AI (Gemini) | Docker Ready
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
from loguru import logger
import sys

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1 import auth, market, ai_chat, admin

logger.remove()
logger.add(sys.stdout, format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}", level="INFO")
logger.add("logs/app.log", rotation="10 MB", retention="7 days", level="DEBUG")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 MDP starting…")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed default admin if none exists
    await _seed_admin()
    logger.info("✅ Ready")
    yield
    logger.info("🛑 Shutdown")

async def _seed_admin():
    from app.core.database import AsyncSessionLocal
    from app.core.security import hash_password
    from app.models.models import User, UserRole
    from sqlalchemy import select
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.role == UserRole.ADMIN))
        if not result.scalar_one_or_none():
            admin = User(full_name="Super Admin", email="admin@mdp.com",
                         hashed_password=hash_password("Admin@123"),
                         role=UserRole.ADMIN, is_active=True)
            db.add(admin)
            await db.commit()
            logger.info("✅ Default admin seeded: admin@mdp.com / Admin@123")

app = FastAPI(
    title="Market Diagnosis Platform",
    description="Diagnosis, Not Prediction. | NSE & BSE | Explainable AI",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=settings.ALLOWED_ORIGINS,
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router,      prefix="/api/v1/auth",    tags=["Auth"])
app.include_router(market.router,    prefix="/api/v1/market",  tags=["Market"])
app.include_router(ai_chat.router,   prefix="/api/v1/ai",      tags=["AI Chat"])
app.include_router(admin.router,     prefix="/api/v1/admin",   tags=["Admin"])

@app.get("/health")
async def health():
    return {"status": "ok", "platform": "MDP v1.0"}

@app.get("/")
async def root():
    return {"message": "Market Diagnosis Platform API", "docs": "/api/docs"}
