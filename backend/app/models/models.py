"""
Database Models — Market Diagnosis Platform
User, Admin, MarketSnapshot, HealthScore, AIReport, AIChatLog
"""
import enum
from datetime import datetime
from sqlalchemy import (Column, Integer, String, Float, Date, DateTime,
                        Text, JSON, Boolean, Enum as SAEnum, ForeignKey)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


# ── Enums ──────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"

class RegimeType(str, enum.Enum):
    BULL = "Bull"
    BEAR = "Bear"
    SIDEWAYS = "Sideways"
    STABLE = "Stable"
    CAUTIOUS = "Cautious"
    STRESSED = "Stressed"


# ── Users ──────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, index=True)
    full_name     = Column(String(120), nullable=False)
    email         = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role          = Column(SAEnum(UserRole), default=UserRole.USER, nullable=False)
    is_active     = Column(Boolean, default=True)
    is_verified   = Column(Boolean, default=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    last_login    = Column(DateTime(timezone=True), nullable=True)

    chat_logs     = relationship("AIChatLog", back_populates="user", cascade="all, delete")


# ── Market Snapshot ────────────────────────────────────────────
class MarketSnapshot(Base):
    __tablename__ = "market_snapshots"
    id                 = Column(Integer, primary_key=True)
    date               = Column(Date, unique=True, index=True, nullable=False)

    nse_advances       = Column(Integer)
    nse_declines       = Column(Integer)
    nse_vix            = Column(Float)
    nse_nifty_open     = Column(Float)
    nse_nifty_close    = Column(Float)
    nse_nifty_high     = Column(Float)
    nse_nifty_low      = Column(Float)
    nse_volume         = Column(Float)

    bse_advances       = Column(Integer)
    bse_declines       = Column(Integer)
    bse_sensex_open    = Column(Float)
    bse_sensex_close   = Column(Float)
    bse_sensex_high    = Column(Float)
    bse_sensex_low     = Column(Float)

    # Feature Engineering outputs
    nse_rsi            = Column(Float)
    nse_macd           = Column(Float)
    nse_sma_20         = Column(Float)
    volatility_ratio   = Column(Float)
    participation_score = Column(Float)

    created_at         = Column(DateTime(timezone=True), server_default=func.now())


# ── Market Health Score ────────────────────────────────────────
class MarketHealthScore(Base):
    __tablename__ = "market_health_scores"
    id               = Column(Integer, primary_key=True)
    date             = Column(Date, unique=True, index=True)
    overall_score    = Column(Float)
    volatility_score = Column(Float)
    participation_score = Column(Float)
    stability_score  = Column(Float)
    exchange_sync_score = Column(Float)
    regime           = Column(SAEnum(RegimeType))
    stress_level     = Column(Float)
    features_json    = Column(JSON)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


# ── AI Diagnostic Report ───────────────────────────────────────
class AIReport(Base):
    __tablename__ = "ai_reports"
    id               = Column(Integer, primary_key=True)
    date             = Column(Date, unique=True, index=True)
    narrative        = Column(Text)
    key_findings     = Column(JSON)
    exchange_comparison = Column(JSON)
    risk_flags       = Column(JSON)
    regime_summary   = Column(String(200))
    generated_by     = Column(String(50), default="gemini-1.5-flash")
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


# ── AI Chat Log (per user) ─────────────────────────────────────
class AIChatLog(Base):
    __tablename__ = "ai_chat_logs"
    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    user_msg   = Column(Text, nullable=False)
    ai_reply   = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user       = relationship("User", back_populates="chat_logs")
