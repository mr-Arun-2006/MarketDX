import asyncio
from datetime import datetime, timezone

from app.services.websocket_manager import manager


class MarketStream:
    """Demo market stream used until a broker's live feed is configured."""

    def __init__(self) -> None:
        self.running = False

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
