"""Provider adapters for EOD and fundamentals enrichment.

TejHQ is the primary per-equity EOD source. BharatStock is an optional,
quota-limited fundamentals/enrichment source. No live quote provider is
currently configured. Nifty/Sensex/VIX index diagnosis remains explicitly
sourced from Yahoo Finance until an index EOD feed is integrated.
"""
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
    BHARATSTOCK_CACHE_SECONDS = 1800
    SNAPSHOT_CACHE_SECONDS = 21600

    # Small process-local cache prevents a dashboard refresh from burning through
    # BharatStock's 60-request free daily quota. It is not a substitute for Redis
    # when the service runs multiple workers/replicas.
    _bharat_cache: dict[tuple, tuple[float, Any]] = {}
    _snapshot_cache: dict[tuple, tuple[float, list[dict]]] = {}

    @staticmethod
    def _ensure_tej_eod_selected() -> None:
        provider = (settings.EOD_DATA_PROVIDER or "tej").strip().lower()
        if provider != "tej":
            raise ProviderNotConfigured(
                f"Unsupported EOD_DATA_PROVIDER '{provider}'. This build supports 'tej'."
            )

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
        self._ensure_tej_eod_selected()
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
        self._ensure_tej_eod_selected()
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
        self._ensure_tej_eod_selected()
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

        # BharatStock documents exchange selection on the stock sub-endpoints.
        request_params = {"exchange": exchange, **(params or {})}
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
                "provider_id": (settings.EOD_DATA_PROVIDER or "tej").strip().lower(),
                "status": "ready" if (settings.EOD_DATA_PROVIDER or "tej").strip().lower() == "tej" else "unsupported",
                "configured": (settings.EOD_DATA_PROVIDER or "tej").strip().lower() == "tej",
                "is_live": False,
                "coverage": {"NSE": "2010 onwards", "BSE": "2024-07 onwards"},
                "features": ["daily OHLCV", "full-market snapshots", "corporate actions"],
                "keyed_features": ["back-adjusted prices", "NSE delivery quantity and delivery %"],
                "free_key_status": "configured" if bool(settings.TEJ_API_KEY) else "optional_key_required",
                "free_key_quota": "1,000 requests/day; 300/minute",
                "note": "Keyless/free and Retail access are for personal use. TejHQ Pro covers commercial product use, but TejHQ states it has no NSE/BSE data licence; confirm exchange display rights separately.",
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
                "note": "Free is for personal/evaluation/internal non-commercial use. Public display of permitted filing data needs a paid tier; exchange-owned OHLCV/index display needs a direct exchange licence.",
            },
            "live": {
                "provider": "Not configured",
                "provider_id": "none",
                "status": "disabled",
                "configured": False,
                "is_live": False,
                "transport": "disabled",
                "note": "Live quotes are intentionally disabled. Select a replacement provider before enabling intraday prices.",
            },
            "index_diagnosis": {
                "provider": "Yahoo Finance (yfinance)",
                "status": "fallback",
                "configured": True,
                "is_live": False,
                "note": "Temporary index-only fallback for Nifty, Sensex, India VIX and Bank Nifty. Tej's documented OHLCV API is equity-symbol based.",
            },
        }



market_data_service = MarketDataService()
