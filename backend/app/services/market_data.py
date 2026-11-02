"""Provider adapters for EOD, fundamentals enrichment and live quotes.

TejHQ is the primary per-equity EOD source. BharatStock is an optional,
quota-limited fundamentals/enrichment source. Upstox is the separate live
quote source. Nifty/Sensex/VIX index diagnosis remains explicitly sourced
from Yahoo Finance until an index EOD feed is integrated.
"""
from datetime import datetime, timezone
from time import monotonic
from typing import Any

import httpx
import yfinance as yf

from app.core.config import settings


class ProviderNotConfigured(RuntimeError):
    """The selected provider exists but its credentials/configuration are absent."""


class ProviderRequestError(RuntimeError):
    """A market data provider failed or returned an invalid response."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


class MarketDataService:
    TEJ_BASE_URL = "https://api.tejhq.dev/v1"
    BHARATSTOCK_BASE_URL = "https://bharatstockapi.com/v1"
    UPSTOX_QUOTES_URL = "https://api.upstox.com/v2/market-quote/quotes"
    BHARATSTOCK_CACHE_SECONDS = 1800
    SNAPSHOT_CACHE_SECONDS = 21600

    # Small process-local cache prevents a dashboard refresh from burning through
    # BharatStock's 60-request free daily quota. It is not a substitute for Redis
    # when the service runs multiple workers/replicas.
    _bharat_cache: dict[tuple, tuple[float, Any]] = {}
    _snapshot_cache: dict[tuple, tuple[float, list[dict]]] = {}

    def fetch_index_eod_history(self, tickers: list[str], start: Any, end: Any):
        """Fetch index-only series that Tej's documented equity API does not expose."""
        return yf.download(
            tickers,
            start=start,
            end=end,
            progress=False,
            auto_adjust=True,
            threads=False,
        )

    @staticmethod
    def _unwrap_rows(payload: Any) -> list[dict]:
        if isinstance(payload, list):
            return [row for row in payload if isinstance(row, dict)]
        if isinstance(payload, dict):
            for key in ("data", "results", "rows", "items"):
                value = payload.get(key)
                if isinstance(value, list):
                    return [row for row in value if isinstance(row, dict)]
            # Some single-record provider endpoints return one object directly.
            if any(key in payload for key in ("date", "trade_date", "ex_date", "as_on_date")):
                return [payload]
        return []

    @staticmethod
    def _provider_error(response: httpx.Response, provider: str) -> ProviderRequestError:
        status = response.status_code
        if status == 429:
            return ProviderRequestError(
                f"{provider} rate limit reached. Wait for the quota window to reset.", 429
            )
        if status in (401, 403):
            return ProviderRequestError(
                f"{provider} rejected the API credentials or access is not permitted.", 503
            )
        if status == 404:
            return ProviderRequestError(
                f"{provider} has no data for this symbol or endpoint.", 404
            )
        return ProviderRequestError(f"{provider} request failed with HTTP {status}.", 502)

    async def fetch_tej_eod(
        self,
        symbol: str,
        exchange: str = "NSE",
        from_date: str | None = None,
        to_date: str | None = None,
    ) -> dict:
        exchange = exchange.upper()
        if exchange not in {"NSE", "BSE"}:
            raise ValueError("exchange must be NSE or BSE")

        params = {}
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date

        url = f"{self.TEJ_BASE_URL}/ohlcv/{exchange.lower()}/{symbol.upper()}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(url, params=params)
                if response.status_code >= 400:
                    raise self._provider_error(response, "TejHQ")
                payload = response.json()
        except httpx.RequestError as exc:
            raise ProviderRequestError("Could not connect to TejHQ EOD API.") from exc
        except ValueError as exc:
            raise ProviderRequestError("TejHQ returned invalid JSON.") from exc

        rows = self._unwrap_rows(payload)
        if not rows:
            raise ProviderRequestError("TejHQ returned no EOD rows for the requested symbol.")
        dates = [str(row.get("date") or row.get("trade_date") or "") for row in rows]
        valid_dates = [value for value in dates if value]
        return {
            "mode": "EOD",
            "provider": "TejHQ / Tej Bazaar",
            "exchange": exchange,
            "symbol": symbol.upper(),
            "is_live": False,
            "as_of": max(valid_dates) if valid_dates else None,
            "count": len(rows),
            "data": rows,
            "source_url": url,
            "notice": "Daily end-of-day candles; not an intraday/live feed.",
        }


    def fetch_tej_snapshot(self, exchange: str, trading_date: str) -> list[dict]:
        """Fetch a real full-market EOD snapshot for actual advances/declines."""
        exchange = exchange.lower()
        if exchange not in {"nse", "bse"}:
            raise ValueError("exchange must be NSE or BSE")
        cache_key = (exchange, trading_date)
        now = monotonic()
        cached = self._snapshot_cache.get(cache_key)
        if cached and now - cached[0] < self.SNAPSHOT_CACHE_SECONDS:
            return cached[1]

        url = f"{self.TEJ_BASE_URL}/snapshot/{exchange}"
        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.get(url, params={"date": trading_date})
                if response.status_code >= 400:
                    raise self._provider_error(response, "TejHQ")
                payload = response.json()
        except httpx.RequestError as exc:
            raise ProviderRequestError("Could not connect to TejHQ market snapshot API.") from exc
        except ValueError as exc:
            raise ProviderRequestError("TejHQ returned invalid market snapshot JSON.") from exc

        rows = self._unwrap_rows(payload)
        if len(self._snapshot_cache) >= 8:
            self._snapshot_cache.pop(next(iter(self._snapshot_cache)))
        self._snapshot_cache[cache_key] = (now, rows)
        return rows

    async def _fetch_tej_keyed_rows(
        self,
        section: str,
        symbol: str,
        exchange: str,
        from_date: str | None = None,
        to_date: str | None = None,
    ) -> dict:
        api_key = settings.TEJ_API_KEY.strip()
        if not api_key:
            raise ProviderNotConfigured(
                "TejHQ adjusted/delivery data needs a free API key. Add TEJ_API_KEY to the backend environment."
            )
        exchange = exchange.upper()
        if exchange not in {"NSE", "BSE"}:
            raise ValueError("exchange must be NSE or BSE")
        if section == "delivery" and exchange != "NSE":
            raise ValueError("TejHQ delivery data is available for NSE only.")

        params = {}
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date
        url = f"{self.TEJ_BASE_URL}/{section}/{exchange.lower()}/{symbol.upper()}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {api_key}"},
                    params=params,
                )
                if response.status_code >= 400:
                    raise self._provider_error(response, "TejHQ")
                payload = response.json()
        except httpx.RequestError as exc:
            raise ProviderRequestError(f"Could not connect to TejHQ {section} API.") from exc
        except ValueError as exc:
            raise ProviderRequestError(f"TejHQ returned invalid {section} JSON.") from exc

        rows = self._unwrap_rows(payload)
        if not rows:
            raise ProviderRequestError(f"TejHQ returned no {section} rows for {symbol}.", 404)
        dates = [str(row.get("date") or "") for row in rows if row.get("date")]
        return {
            "provider": "TejHQ / Tej Bazaar",
            "dataset": section,
            "exchange": exchange,
            "symbol": symbol.upper(),
            "is_live": False,
            "as_of": max(dates) if dates else None,
            "count": len(rows),
            "data": rows,
            "notice": "Historical end-of-day data; this endpoint is not a live feed.",
        }

    async def fetch_tej_adjusted(
        self, symbol: str, exchange: str = "NSE",
        from_date: str | None = None, to_date: str | None = None,
    ) -> dict:
        return await self._fetch_tej_keyed_rows("adjusted", symbol, exchange, from_date, to_date)

    async def fetch_tej_delivery(
        self, symbol: str, exchange: str = "NSE",
        from_date: str | None = None, to_date: str | None = None,
    ) -> dict:
        return await self._fetch_tej_keyed_rows("delivery", symbol, exchange, from_date, to_date)

    async def fetch_tej_actions(self, symbol: str, exchange: str = "NSE") -> dict:
        exchange = exchange.upper()
        if exchange not in {"NSE", "BSE"}:
            raise ValueError("exchange must be NSE or BSE")
        url = f"{self.TEJ_BASE_URL}/actions/{symbol.upper()}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Tej's documented actions endpoint accepts only the symbol path.
                response = await client.get(url)
                if response.status_code >= 400:
                    raise self._provider_error(response, "TejHQ")
                payload = response.json()
        except httpx.RequestError as exc:
            raise ProviderRequestError("Could not connect to TejHQ corporate-actions API.") from exc
        except ValueError as exc:
            raise ProviderRequestError("TejHQ returned invalid corporate-actions JSON.") from exc

        rows = self._unwrap_rows(payload)
        # The keyless actions API returns exchange as a row field, not a query filter.
        rows = [
            row for row in rows
            if str(row.get("exchange", "")).upper() == exchange
        ]
        return {
            "provider": "TejHQ / Tej Bazaar",
            "exchange": exchange,
            "symbol": symbol.upper(),
            "count": len(rows),
            "data": rows,
        }

    async def fetch_bharatstock_data(
        self,
        symbol: str,
        section: str,
        exchange: str = "NSE",
        params: dict | None = None,
    ) -> dict:
        allowed = {"financials", "ratios", "shareholding", "corporate-actions"}
        if section not in allowed:
            raise ValueError(f"section must be one of: {', '.join(sorted(allowed))}")

        api_key = settings.BHARATSTOCK_API_KEY.strip()
        if not api_key:
            raise ProviderNotConfigured(
                "BharatStock is not configured. Add BHARATSTOCK_API_KEY to the backend environment."
            )

        exchange = exchange.upper()
        if exchange not in {"NSE", "BSE"}:
            raise ValueError("exchange must be NSE or BSE")

        # The documented per-stock sections accept section-specific filters,
        # but do not document an exchange query parameter. Keep it out of the
        # upstream request to avoid relying on ignored/unsupported query fields.
        request_params = dict(params or {})
        # Keep the cache key deterministic and avoid caching credentials.
        cache_key = (
            symbol.upper(),
            section,
            exchange,
            tuple(sorted((str(k), str(v)) for k, v in request_params.items())),
        )
        cached = self._bharat_cache.get(cache_key)
        now = monotonic()
        if cached and now - cached[0] < self.BHARATSTOCK_CACHE_SECONDS:
            return {**cached[1], "cache": "hit"}

        url = f"{self.BHARATSTOCK_BASE_URL}/stocks/{symbol.upper()}/{section}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    url,
                    headers={"X-API-Key": api_key, "Accept": "application/json"},
                    params=request_params,
                )
                if response.status_code >= 400:
                    raise self._provider_error(response, "BharatStock")
                payload = response.json()
        except httpx.RequestError as exc:
            raise ProviderRequestError("Could not connect to BharatStock API.") from exc
        except ValueError as exc:
            raise ProviderRequestError("BharatStock returned invalid JSON.") from exc

        result = {
            "provider": "BharatStock",
            "section": section,
            "exchange": exchange,
            "symbol": symbol.upper(),
            "history_limit": "Free plan: latest 1 year for time-series data; 2 years for annual financials",
            "data": payload,
            "cache": "miss",
        }
        if len(self._bharat_cache) >= 512:
            # Bounded best-effort eviction; Redis is the right shared cache for
            # multi-worker production deployments.
            self._bharat_cache.pop(next(iter(self._bharat_cache)))
        self._bharat_cache[cache_key] = (now, result)
        return result

    def source_status(self) -> dict:
        return {
            "primary_eod": {
                "provider": "TejHQ / Tej Bazaar",
                "provider_id": "tej",
                "status": "ready",
                "configured": True,
                "is_live": False,
                "coverage": {"NSE": "2010 onwards", "BSE": "2024-07 onwards"},
                "features": ["daily OHLCV", "full-market snapshots", "corporate actions"],
                "keyed_features": ["back-adjusted prices", "NSE delivery quantity and delivery %"],
                "free_key_status": "configured" if bool(settings.TEJ_API_KEY) else "optional_key_required",
                "free_key_quota": "1,000 requests/day; 300/minute",
                "note": "OHLCV/snapshots/actions are keyless. Adjusted prices and NSE delivery require a free TejHQ API key.",
            },
            "eod_enrichment": {
                "provider": "BharatStock",
                "provider_id": "bharatstock",
                "status": "ready" if bool(settings.BHARATSTOCK_API_KEY) else "needs_api_key",
                "configured": bool(settings.BHARATSTOCK_API_KEY),
                "is_live": False,
                "daily_quota": "60 requests/day on Free plan",
                "history_limit": "Latest 1 year for time-series data; 2 years for annual financials on Free plan",
                "features": ["financial statements", "valuation ratios", "shareholding", "corporate actions"],
                "note": "Optional enrichment only; cache responses to protect the daily quota.",
            },
            "live": {
                "provider": "Upstox Market Quote API",
                "provider_id": "upstox",
                "status": "ready" if bool(settings.UPSTOX_ACCESS_TOKEN) else "needs_credentials",
                "configured": bool(settings.UPSTOX_ACCESS_TOKEN),
                "is_live": True,
                "transport": "REST quote snapshots; dashboard polling",
                "note": "Requires an Upstox access token. Separate from EOD analysis.",
            },
            "index_diagnosis": {
                "provider": "Yahoo Finance (yfinance)",
                "status": "fallback",
                "configured": True,
                "is_live": False,
                "note": "Temporary index-only fallback for Nifty, Sensex, India VIX and Bank Nifty. Tej's documented OHLCV API is equity-symbol based.",
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
            raise ProviderNotConfigured(
                f"Unsupported LIVE_DATA_PROVIDER '{provider}'. Configure 'upstox'."
            )

        token = settings.UPSTOX_ACCESS_TOKEN.strip()
        if not token:
            raise ProviderNotConfigured(
                "Live quotes are not configured. Add UPSTOX_ACCESS_TOKEN to the backend "
                "environment and restart the API."
            )

        instrument_keys = [
            item.strip()
            for item in settings.UPSTOX_INSTRUMENT_KEYS.split(",")
            if item.strip()
        ]
        if not instrument_keys:
            raise ProviderNotConfigured(
                "No Upstox instruments configured. Set UPSTOX_INSTRUMENT_KEYS."
            )

        headers = {"Accept": "application/json", "Authorization": f"Bearer {token}"}
        params = {"instrument_key": ",".join(instrument_keys)}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(self.UPSTOX_QUOTES_URL, headers=headers, params=params)
                if response.status_code >= 400:
                    raise self._provider_error(response, "Upstox")
                payload = response.json()
        except httpx.RequestError as exc:
            raise ProviderRequestError("Could not connect to Upstox quote API.") from exc
        except ValueError as exc:
            raise ProviderRequestError("Upstox returned invalid quote JSON.") from exc

        raw_quotes = payload.get("data") or {}
        if not isinstance(raw_quotes, dict) or not raw_quotes:
            raise ProviderRequestError("Upstox returned no quotes for the configured instruments.")

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
