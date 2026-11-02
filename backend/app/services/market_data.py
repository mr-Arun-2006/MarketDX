"""Market data source adapters for MarketDX.

EOD is deliberately kept separate from live quote retrieval:
- Yahoo Finance/yfinance supplies daily historical candles for diagnosis.
- Upstox supplies exchange-sourced quote snapshots for the live dashboard.
"""
from datetime import datetime, timezone
from typing import Any

import httpx
import yfinance as yf

from app.core.config import settings


class LiveDataNotConfigured(RuntimeError):
    """Raised when the selected live provider has not been configured."""


class LiveDataProviderError(RuntimeError):
    """Raised when the live provider cannot return a usable response."""


class MarketDataService:
    UPSTOX_QUOTES_URL = "https://api.upstox.com/v2/market-quote/quotes"

    def fetch_eod_history(self, tickers: list[str], start: Any, end: Any):
        provider = (settings.EOD_DATA_PROVIDER or "yfinance").strip().lower()
        if provider != "yfinance":
            raise ValueError(
                f"Unsupported EOD_DATA_PROVIDER '{provider}'. "
                "The configured EOD adapter currently supports 'yfinance'."
            )
        return yf.download(
            tickers,
            start=start,
            end=end,
            progress=False,
            auto_adjust=True,
            threads=False,
        )

    def source_status(self) -> dict:
        eod_provider = (settings.EOD_DATA_PROVIDER or "yfinance").strip().lower()
        live_provider = (settings.LIVE_DATA_PROVIDER or "upstox").strip().lower()
        eod_ready = eod_provider == "yfinance"
        live_supported = live_provider == "upstox"
        live_configured = bool(settings.UPSTOX_ACCESS_TOKEN) and live_supported

        return {
            "primary": {
                "mode": "EOD",
                "provider": "Yahoo Finance (yfinance)" if eod_provider == "yfinance" else eod_provider,
                "provider_id": eod_provider,
                "role": "Primary source for historical daily candles and market diagnosis",
                "status": "ready" if eod_ready else "unsupported",
                "configured": eod_ready,
                "is_live": False,
                "freshness": "End-of-day; latest completed daily candle",
                "note": (
                    "Third-party public data source. Validate important values against "
                    "your exchange-authorized data provider."
                ),
            },
            "secondary": {
                "mode": "LIVE",
                "provider": "Upstox Market Quote API" if live_supported else live_provider,
                "provider_id": live_provider,
                "role": "Secondary source for current-session dashboard quotes",
                "status": (
                    "ready" if live_configured
                    else "needs_credentials" if live_supported
                    else "unsupported"
                ),
                "configured": live_configured,
                "is_live": True,
                "transport": "REST quote snapshots; dashboard polls every 15 seconds",
                "note": (
                    "Requires an Upstox API access/analytics token. The server keeps the "
                    "token private and never sends it to the browser."
                ),
            },
        }

    @staticmethod
    def _timestamp_to_iso(value: Any) -> str | None:
        if value is None or value == "":
            return None
        try:
            numeric = float(value)
            seconds = numeric / 1000 if numeric > 10_000_000_000 else numeric
            return datetime.fromtimestamp(seconds, tz=timezone.utc).isoformat()
        except (TypeError, ValueError, OverflowError):
            pass
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.isoformat()
        except ValueError:
            return str(value)

    @classmethod
    def normalize_upstox_quote(cls, instrument_key: str, quote: dict) -> dict:
        ohlc = quote.get("ohlc") or {}
        last_price = quote.get("last_price")
        previous_close = ohlc.get("close") or quote.get("prev_close_price")
        net_change = quote.get("net_change")

        if net_change is None and last_price is not None and previous_close:
            net_change = float(last_price) - float(previous_close)

        change_percent = None
        if net_change is not None and previous_close:
            try:
                change_percent = round(float(net_change) / float(previous_close) * 100, 2)
            except (TypeError, ValueError, ZeroDivisionError):
                change_percent = None

        return {
            "instrument_key": quote.get("instrument_token") or instrument_key,
            "symbol": quote.get("symbol") or instrument_key.split("|")[-1],
            "last_price": float(last_price) if last_price is not None else None,
            "change": round(float(net_change), 2) if net_change is not None else None,
            "change_percent": change_percent,
            "previous_close": float(previous_close) if previous_close is not None else None,
            "open": ohlc.get("open"),
            "high": ohlc.get("high"),
            "low": ohlc.get("low"),
            "volume": quote.get("volume"),
            "last_trade_time": cls._timestamp_to_iso(
                quote.get("last_trade_time") or quote.get("timestamp")
            ),
        }

    async def fetch_live_quotes(self) -> dict:
        provider = (settings.LIVE_DATA_PROVIDER or "upstox").strip().lower()
        if provider != "upstox":
            raise LiveDataNotConfigured(
                f"Unsupported LIVE_DATA_PROVIDER '{provider}'. Configure 'upstox'."
            )

        token = settings.UPSTOX_ACCESS_TOKEN.strip()
        if not token:
            raise LiveDataNotConfigured(
                "Live quotes are not configured. Add UPSTOX_ACCESS_TOKEN to the backend "
                "environment and restart the API."
            )

        instrument_keys = [
            item.strip()
            for item in settings.UPSTOX_INSTRUMENT_KEYS.split(",")
            if item.strip()
        ]
        if not instrument_keys:
            raise LiveDataNotConfigured(
                "No Upstox instruments configured. Set UPSTOX_INSTRUMENT_KEYS."
            )

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
        }
        params = {"instrument_key": ",".join(instrument_keys)}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    self.UPSTOX_QUOTES_URL,
                    headers=headers,
                    params=params,
                )
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            if status_code in (401, 403):
                message = "Upstox rejected the token. Generate or refresh the API token."
            elif status_code == 429:
                message = "Upstox rate limit reached. Reduce quote polling frequency."
            else:
                message = f"Upstox quote request failed with HTTP {status_code}."
            raise LiveDataProviderError(message) from exc
        except (httpx.RequestError, ValueError) as exc:
            raise LiveDataProviderError(
                "Could not connect to Upstox or parse its quote response."
            ) from exc

        raw_quotes = payload.get("data") or {}
        if not isinstance(raw_quotes, dict) or not raw_quotes:
            raise LiveDataProviderError(
                "Upstox returned no quotes for the configured instrument keys."
            )

        quotes = [
            self.normalize_upstox_quote(key, quote)
            for key, quote in raw_quotes.items()
            if isinstance(quote, dict)
        ]
        return {
            "mode": "LIVE",
            "provider": "Upstox Market Quote API",
            "transport": "REST snapshot",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "refresh_seconds": 15,
            "quotes": quotes,
        }


market_data_service = MarketDataService()
