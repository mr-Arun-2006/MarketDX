from datetime import datetime, timezone

from app.services.websocket_manager import manager


class MarketStream:
    """Publish normalized market ticks from a broker adapter to clients."""

    async def publish(self, symbol: str, price: float, change: float = 0.0) -> None:
        await manager.broadcast({
            "type": "market_tick",
            "data": {
                "symbol": symbol,
                "price": price,
                "change": change,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        })


market_stream = MarketStream()
