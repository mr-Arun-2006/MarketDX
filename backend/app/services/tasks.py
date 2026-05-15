from app.core.celery_app import celery_app
from app.services.health_engine import MarketHealthEngine
from app.services.ai_service import ai_service
from loguru import logger
from datetime import date

@celery_app.task(name="app.services.tasks.fetch_and_score", bind=True, max_retries=3)
def fetch_and_score(self, target_date: str = None):
    try:
        engine = MarketHealthEngine()
        d = date.fromisoformat(target_date) if target_date else None
        features = engine.collect(d)
        if not features:
            logger.warning("No market data — possible holiday")
            return {"status": "holiday"}
        result  = engine.score(features)
        exchange = engine.compare_exchanges(features)
        report  = ai_service.generate_report(
            {
                "overall_score": result.overall_score,
                "regime": result.regime,
                "stress_level": result.stress_level,
                "volatility_score": result.volatility_score,
                "participation_score": result.participation_score,
                "stability_score": result.stability_score,
                "exchange_sync_score": result.exchange_sync_score,
                "momentum_score": result.momentum_score,
                "trend_signal": result.trend_signal,
                "risk_flags": result.risk_flags,
                "nse_rsi": features.nse_rsi,
                "nse_macd_hist": features.nse_macd_hist,
                "price_vs_sma20": features.price_vs_sma20,
                "price_vs_sma50": features.price_vs_sma50,
            },
            exchange
        )
        logger.info(f"✅ Score: {result.overall_score} | Regime: {result.regime} | Trend: {result.trend_signal}")
        return {"status": "ok", "score": result.overall_score, "regime": result.regime}
    except Exception as exc:
        logger.error(f"Task failed: {exc}")
        raise self.retry(exc=exc, countdown=300)
