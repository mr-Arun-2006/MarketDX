"""
AI Chat Endpoint v2
POST /api/v1/ai/chat   → chat with Gemini, receives full live market context
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from app.core.deps import get_current_user
from app.models.models import User
from app.services.ai_service import ai_service
from app.services.health_engine import MarketHealthEngine

router = APIRouter()
engine = MarketHealthEngine()


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = []   # [{role, text}] for future multi-turn


@router.post("/chat")
async def chat(req: ChatRequest, user: User = Depends(get_current_user)):
    # Build rich live context
    ctx = None
    try:
        f = engine.collect()
        if f:
            r = engine.score(f)
            ctx = {
                "score":   r.overall_score,
                "regime":  r.regime,
                "trend":   r.trend_signal,
                "vix":     f.nse_vix,
                "rsi":     f.nse_rsi,
                "stress":  r.stress_level,
                "macd_hist": f.nse_macd_hist,
                "vs_sma20": f.price_vs_sma20,
                "vs_sma50": f.price_vs_sma50,
                "bank_nifty_ret": f.bank_nifty_return,
                "nifty_ret": f.nse_return,
                "sensex_ret": f.bse_return,
            }
    except Exception:
        pass   # chat still works without live context

    reply = ai_service.chat(req.message, context=ctx, history=req.history)
    return {"reply": reply, "user": user.full_name, "context_loaded": ctx is not None}
