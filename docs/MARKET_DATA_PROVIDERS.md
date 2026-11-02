# Market data provider integration

MarketDX separates daily analysis data from intraday dashboard quotes. Provider identity, configuration state, and data timestamps are returned by the market source-status and EOD endpoints.

## Provider routing

| Use | Provider | Access |
| --- | --- | --- |
| Equity EOD OHLCV | TejHQ / Tej Bazaar | Keyless REST |
| Real daily market breadth | TejHQ full-market snapshots | Keyless REST |
| Corporate actions | TejHQ | Keyless REST |
| Back-adjusted prices | TejHQ | Free API key |
| NSE delivery quantity / percentage | TejHQ | Free API key; NSE only |
| Financial statements, ratios, shareholding, corporate actions | BharatStock | API key; Free plan 60 calls/day |
| Intraday/live quotes | Disabled | No provider configured |
| Nifty, Sensex, India VIX and Bank Nifty index series | Yahoo Finance | Temporary index-only fallback |

### TejHQ / Tej Bazaar

The documented keyless OHLCV endpoint defaults to the latest 90 days. Supply `from` and `to` to request another date range. NSE history starts on 2010-01-04; BSE history starts on 2024-07-08. TejHQ's pipeline runs around 18:30 IST with a 21:30 IST retry. MarketDX's Celery job is scheduled for 22:00 IST on weekdays so it runs after that retry window; use TejHQ's status endpoint if a trading day's publication is delayed.

The keyless endpoints cover daily OHLCV, full-market snapshots and corporate actions. A free TejHQ API key unlocks back-adjusted prices and NSE delivery quantity / delivery percentage, with a stated free-key quota of 1,000 calls/day and 300 calls/minute. The API key uses `Authorization: Bearer ...` (or `X-Api-Key`).

### BharatStock enrichment

MarketDX requests one BharatStock section per user action; it does not automatically fan out enrichment calls for every stock. The Free plan has 60 calls/day and returns at most the latest year for time-series endpoints; annual financial statements can return two years. MarketDX caches successful section responses for 30 minutes in each backend process to reduce calls. This cache is process-local, so deployments with multiple workers should use a shared Redis cache and a daily quota guard.

The implemented section paths follow BharatStock's reference and pass `exchange=NSE|BSE` to disambiguate cross-listed or shared tickers:

- `GET /v1/stocks/{ticker}/financials` with `period_type=quarterly|annual`, `page`, and `page_size`.
- `GET /v1/stocks/{ticker}/ratios`.
- `GET /v1/stocks/{ticker}/shareholding`.
- `GET /v1/stocks/{ticker}/corporate-actions` with optional `action_type`.

Authentication uses `X-API-Key`.

### Live quote status

Intraday/live quotes are intentionally disabled in this version. No broker token, Upstox adapter, live quote API route or browser polling is configured. Choose and verify a replacement provider before enabling live prices; EOD history and EOD enrichment continue independently.

### Index-series limitation

TejHQ's published OHLCV endpoints are equity-symbol based; the current integration does not use them for Nifty, Sensex, India VIX or Bank Nifty index candles. The existing dashboard diagnosis for those index series therefore retains a clearly labelled Yahoo Finance fallback. TejHQ full-market snapshots replace the engine's estimated advances/declines with real exchange snapshot counts where the snapshot is available. The source metadata exposes both index and breadth providers.

## Backend environment

Add these to the backend deployment environment. Do not commit real values.

```dotenv
EOD_DATA_PROVIDER=tej
TEJ_API_KEY=
BHARATSTOCK_API_KEY=
# Live quote feed intentionally disabled until a replacement provider is selected.
```

## MarketDX API routes

All MarketDX routes below require a MarketDX user access token:

- `GET /api/v1/market/sources`
- `GET /api/v1/market/stocks/{symbol}/eod?exchange=NSE&from=2026-08-01&to=2026-11-02`
- `GET /api/v1/market/stocks/{symbol}/adjusted?exchange=NSE&from=2026-08-01`
- `GET /api/v1/market/stocks/{symbol}/delivery?exchange=NSE&from=2026-08-01`
- `GET /api/v1/market/stocks/{symbol}/corporate-actions?exchange=NSE`
- `GET /api/v1/market/stocks/{symbol}/enrichment/financials?period_type=annual`
- `GET /api/v1/market/stocks/{symbol}/enrichment/ratios`
- `GET /api/v1/market/stocks/{symbol}/enrichment/shareholding`
- `GET /api/v1/market/stocks/{symbol}/enrichment/corporate-actions?action_type=dividend`

The BharatStock enrichment route accepts one section per request. It should not be automatically called for every symbol on page load.

## Data-use and redistribution restrictions

API access does not automatically grant a right to redistribute exchange data.

- **TejHQ:** Keyless/open access and a free personal API key do not imply commercial redistribution rights. TejHQ's code being MIT-licensed does not license the underlying NSE/BSE data. Confirm the permitted tier and data rights directly with TejHQ before using its data in a public or commercial MarketDX deployment.
- **BharatStock:** The Free plan is for personal, evaluation, internal or non-commercial local use. Public or retail display of financial statements, ratios, shareholding and corporate actions requires an active paid tier and the applicable attribution. Exchange-owned EOD prices/OHLCV and index values require a separate direct display or redistribution licence from the relevant exchange; a BharatStock subscription does not grant that exchange licence. Do not publicly serve Free-tier stored data.

Before enabling multi-user production access, review each provider's current terms and secure any required licences. Treat prices and derived analysis as informational; validate them against an appropriately licensed primary source before trading or commercial use.
