"""
Market API v2
GET /api/v1/market/eod           → full EOD snapshot + health score
GET /api/v1/market/report        → AI diagnostic narrative
GET /api/v1/market/chart         → 30-day OHLC history for charts
GET /api/v1/market/indicators    → technical indicators summary
GET /api/v1/market/summary       → lightweight summary card
POST /api/v1/market/fetch        → manual trigger
"""
from datetime import date
from fastapi import APIRouter, HTTPException, Depends, Query
from app.services.market_data import (
    market_data_service, ProviderNotConfigured, ProviderRequestError,
)
from app.services.health_engine import MarketHealthEngine
from app.services.ai_service import ai_service
from app.core.deps import get_current_user
from app.models.models import User

router  = APIRouter()
_engine = MarketHealthEngine()


def _get_data():
    f = _engine.collect()
    if not f:
        raise HTTPException(404, "No EOD data available — market may be closed or holiday.")
    return f


# ── Full EOD ──────────────────────────────────────────────────
@router.get("/eod")
async def get_eod(user: User = Depends(get_current_user)):
    f  = _get_data()
    r  = _engine.score(f)
    ex = _engine.compare_exchanges(f)
    return {
        "date": f.date.isoformat(),
        "data_source": {
            "mode": "EOD", "provider": f.data_source,
            "index_provider": f.data_source,
            "breadth_provider": f.breadth_source,
            "as_of": f.data_as_of or f.date.isoformat(),
            "is_live": False, "purpose": "Index-series diagnosis plus TejHQ equity breadth where available",
        },
        "nse": {
            "nifty_open": f.nse_open, "nifty_close": f.nse_close,
            "nifty_high": f.nse_high, "nifty_low": f.nse_low,
            "vix": f.nse_vix, "advances": f.nse_advances,
            "declines": f.nse_declines, "rsi": f.nse_rsi,
            "volume": f.nse_volume,
        },
        "bse": {
            "sensex_open": f.bse_open, "sensex_close": f.bse_close,
            "sensex_high": f.bse_high, "sensex_low": f.bse_low,
            "advances": f.bse_advances, "declines": f.bse_declines,
        },
        "bank_nifty": {
            "close": f.bank_nifty_close,
            "return_pct": f.bank_nifty_return,
        },
        "health_score": {
            "overall": r.overall_score,
            "regime": r.regime,
            "stress_level": r.stress_level,
            "trend_signal": r.trend_signal,
            "support_level": r.support_level,
            "resistance_level": r.resistance_level,
            "pillars": {
                "volatility": r.volatility_score,
                "participation": r.participation_score,
                "stability": r.stability_score,
                "exchange_sync": r.exchange_sync_score,
                "momentum": r.momentum_score,
            },
            "explanations": r.explanations,
            "risk_flags": r.risk_flags,
        },
        "exchange_comparison": ex,
    }


# ── AI Report ─────────────────────────────────────────────────
@router.get("/report")
async def get_ai_report(user: User = Depends(get_current_user)):
    f  = _get_data()
    r  = _engine.score(f)
    ex = _engine.compare_exchanges(f)
    report = ai_service.generate_report(
        {
            "overall_score": r.overall_score, "regime": r.regime,
            "stress_level": r.stress_level, "volatility_score": r.volatility_score,
            "participation_score": r.participation_score, "stability_score": r.stability_score,
            "exchange_sync_score": r.exchange_sync_score, "momentum_score": r.momentum_score,
            "trend_signal": r.trend_signal, "risk_flags": r.risk_flags,
            "nse_rsi": f.nse_rsi, "nse_macd_hist": f.nse_macd_hist,
            "price_vs_sma20": f.price_vs_sma20, "price_vs_sma50": f.price_vs_sma50,
        },
        ex
    )
    return {"date": f.date.isoformat(), **report}


# ── Chart Data ────────────────────────────────────────────────
@router.get("/chart")
async def get_chart_data(user: User = Depends(get_current_user)):
    f = _get_data()
    return {
        "dates": f.history_dates,
        "nse":   f.nse_history,
        "bse":   f.bse_history,
        "vix":   f.vix_history,
    }


# ── Technical Indicators ──────────────────────────────────────
@router.get("/indicators")
async def get_indicators(user: User = Depends(get_current_user)):
    f = _get_data()
    r = _engine.score(f)
    return {
        "date": f.date.isoformat(),
        "rsi": {
            "value": f.nse_rsi,
            "signal": "Overbought" if f.nse_rsi > 70 else "Oversold" if f.nse_rsi < 30 else "Neutral",
            "color": "red" if f.nse_rsi > 70 else "green" if f.nse_rsi < 30 else "yellow",
        },
        "macd": {
            "macd": f.nse_macd,
            "signal": f.nse_macd_signal,
            "histogram": f.nse_macd_hist,
            "crossover": "Bullish" if f.nse_macd > f.nse_macd_signal else "Bearish",
        },
        "bollinger": {
            "upper": f.nse_bb_upper,
            "lower": f.nse_bb_lower,
            "pct_b": f.nse_bb_pct,
            "position": "Near Upper Band" if f.nse_bb_pct > 0.85 else
                        "Near Lower Band" if f.nse_bb_pct < 0.15 else "Mid Range",
        },
        "moving_averages": {
            "sma_20": f.nse_sma_20,
            "sma_50": f.nse_sma_50,
            "price": f.nse_close,
            "vs_sma20_pct": f.price_vs_sma20,
            "vs_sma50_pct": f.price_vs_sma50,
            "trend": "Above both MAs" if f.price_vs_sma20 > 0 and f.price_vs_sma50 > 0 else
                     "Below both MAs" if f.price_vs_sma20 < 0 and f.price_vs_sma50 < 0 else
                     "Mixed",
        },
        "atr": {"value": f.nse_atr, "pct_of_price": round(f.nse_atr/max(f.nse_close,1)*100, 3)},
        "bank_nifty": {"close": f.bank_nifty_close, "return_pct": f.bank_nifty_return},
        "momentum_score": r.momentum_score,
        "trend_signal": r.trend_signal,
        "support_level": r.support_level,
        "resistance_level": r.resistance_level,
    }


# ── Summary Card ──────────────────────────────────────────────
@router.get("/summary")
async def get_summary(user: User = Depends(get_current_user)):
    f = _get_data()
    r = _engine.score(f)
    return {
        "date": f.date.isoformat(),
        "data_source": {
            "mode": "EOD", "provider": f.data_source,
            "as_of": f.data_as_of or f.date.isoformat(), "is_live": False,
        },
        "nifty_close": f.nse_close,
        "nse_return": f.nse_return,
        "vix": f.nse_vix,
        "score": r.overall_score,
        "regime": r.regime,
        "trend_signal": r.trend_signal,
        "stress_level": r.stress_level,
        "risk_flags_count": len(r.risk_flags),
    }


# ── Manual Fetch ──────────────────────────────────────────────
@router.post("/fetch")
async def trigger_fetch(user: User = Depends(get_current_user)):
    from app.services.tasks import fetch_and_score
    fetch_and_score.delay()
    return {"status": "queued", "message": "EOD fetch triggered in background"}


# ── Secondary live quote source ───────────────────────────────
@router.get("/live/quotes")
async def get_live_quotes(user: User = Depends(get_current_user)):
    """Return current-session quote snapshots from the configured broker API."""
    try:
        return await market_data_service.fetch_live_quotes()
    except ProviderNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ProviderRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


# ── Provider inventory ────────────────────────────────────────
@router.get("/sources")
async def get_data_sources(user: User = Depends(get_current_user)):
    """Return provider readiness without exposing API keys or tokens."""
    return market_data_service.source_status()


# ── TejHQ primary EOD equity history ──────────────────────────
@router.get("/stocks/{symbol}/eod")
async def get_stock_eod(
    symbol: str,
    exchange: str = Query("NSE", pattern="^(NSE|BSE)$"),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    user: User = Depends(get_current_user),
):
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="'from' must be on or before 'to'.")
    try:
        return await market_data_service.fetch_tej_eod(
            symbol=symbol,
            exchange=exchange,
            from_date=from_date.isoformat() if from_date else None,
            to_date=to_date.isoformat() if to_date else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ProviderRequestError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc




# ── TejHQ adjusted prices (free API key) ──────────────────────
@router.get("/stocks/{symbol}/adjusted")
async def get_stock_adjusted(
    symbol: str,
    exchange: str = Query("NSE", pattern="^(NSE|BSE)$"),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    user: User = Depends(get_current_user),
):
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="'from' must be on or before 'to'.")
    try:
        return await market_data_service.fetch_tej_adjusted(
            symbol, exchange,
            from_date.isoformat() if from_date else None,
            to_date.isoformat() if to_date else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ProviderNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ProviderRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


# ── TejHQ NSE delivery history (free API key) ─────────────────
@router.get("/stocks/{symbol}/delivery")
async def get_stock_delivery(
    symbol: str,
    exchange: str = Query("NSE", pattern="^(NSE|BSE)$"),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    user: User = Depends(get_current_user),
):
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="'from' must be on or before 'to'.")
    try:
        return await market_data_service.fetch_tej_delivery(
            symbol, exchange,
            from_date.isoformat() if from_date else None,
            to_date.isoformat() if to_date else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ProviderNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ProviderRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

# ── TejHQ corporate actions ────────────────────────────────────
@router.get("/stocks/{symbol}/corporate-actions")
async def get_stock_corporate_actions(
    symbol: str,
    exchange: str = Query("NSE", pattern="^(NSE|BSE)$"),
    user: User = Depends(get_current_user),
):
    try:
        return await market_data_service.fetch_tej_actions(symbol, exchange)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ProviderRequestError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


# ── BharatStock optional fundamentals enrichment ──────────────
@router.get("/stocks/{symbol}/enrichment/{section}")
async def get_stock_enrichment(
    symbol: str,
    section: str,
    exchange: str = Query("NSE", pattern="^(NSE|BSE)$"),
    period_type: str = Query("quarterly", pattern="^(quarterly|annual)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action_type: str | None = Query(None),
    user: User = Depends(get_current_user),
):
    """Fetch one enrichment section per request to respect BharatStock's free quota."""
    # BharatStock documents exchange disambiguation on its stock-detail endpoint,
    # but not on these individual section routes. Reject BSE here rather than
    # silently returning the default NSE listing for an ambiguous symbol.
    if exchange != "NSE":
        raise HTTPException(
            status_code=422,
            detail="BharatStock section endpoints do not document an exchange selector. Use an NSE ticker for this enrichment route; BSE-only enrichment is not enabled until the provider confirms its parameter contract.",
        )
    params = {}
    if section == "financials":
        params.update({"period_type": period_type, "page": page, "page_size": page_size})
    elif section == "shareholding":
        params.update({"page": page, "page_size": page_size})
    elif section == "corporate-actions" and action_type:
        params["action_type"] = action_type

    try:
        return await market_data_service.fetch_bharatstock_data(
            symbol=symbol,
            section=section,
            exchange=exchange,
            params=params,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ProviderNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ProviderRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
