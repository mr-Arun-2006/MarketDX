# Market data provider integration

MarketDX keeps the daily diagnosis feed separate from intraday dashboard quotes.

## Provider routing

| Use | Provider | Access |
| --- | --- | --- |
| Equity EOD OHLCV | TejHQ / Tej Bazaar | Keyless REST |
| Real daily market breadth | TejHQ full-market snapshots | Keyless REST |
| Corporate actions | TejHQ | Keyless REST |
| Back-adjusted prices | TejHQ | Free API key |
| NSE delivery quantity / percentage | TejHQ | Free API key; NSE only |
| Financial statements, ratios, shareholding | BharatStock | API key; Free plan 60 calls/day |
| Intraday quote snapshots | Upstox | Broker API access token |
| Nifty, Sensex, India VIX and Bank Nifty index series | Yahoo Finance | Temporary index-only fallback |

TejHQ's keyless OHLCV endpoint defaults to a recent 90-day window. Supply `from` and `to` to request another date range. NSE history starts in 2010; BSE history starts on 2024-07-08. TejHQ's free key unlocks adjusted and delivery endpoints and has a stated quota of 1,000 requests/day.

BharatStock endpoints are requested one section at a time. MarketDX uses a 30-minute process-local response cache to avoid wasting the Free plan's 60 daily calls. The free plan returns at most the latest year for time-series endpoints and two years for annual financials.

Upstox quotes are fetched independently through the authenticated backend. The browser polls the backend quote endpoint every 15 seconds only when the backend reports that an Upstox token is configured. No provider key is sent to the frontend.

## Backend environment

Add these to the backend deployment environment. Do not commit real values.

```dotenv
EOD_DATA_PROVIDER=tej
TEJ_API_KEY=
BHARATSTOCK_API_KEY=
LIVE_DATA_PROVIDER=upstox
UPSTOX_ACCESS_TOKEN=
UPSTOX_INSTRUMENT_KEYS=NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,BSE_INDEX|SENSEX
```

## API routes

All MarketDX routes below require a MarketDX user access token:

- `GET /api/v1/market/sources`
- `GET /api/v1/market/stocks/{symbol}/eod?exchange=NSE&from=2010-01-04&to=2026-11-02`
- `GET /api/v1/market/stocks/{symbol}/adjusted?exchange=NSE&from=2020-01-01`
- `GET /api/v1/market/stocks/{symbol}/delivery?exchange=NSE&from=2020-01-01`
- `GET /api/v1/market/stocks/{symbol}/corporate-actions?exchange=NSE`
- `GET /api/v1/market/stocks/{symbol}/enrichment/financials?period_type=annual`
- `GET /api/v1/market/stocks/{symbol}/enrichment/ratios`
- `GET /api/v1/market/stocks/{symbol}/enrichment/shareholding`
- `GET /api/v1/market/live/quotes`

The BharatStock enrichment route accepts one section per request. It should not be automatically called for every symbol on page load.

## Important data-use limits

Provider API access is not the same as a redistribution licence.

- TejHQ's code is MIT-licensed, but that does not license the underlying exchange data. TejHQ's published data terms distinguish personal use from commercial product use. Confirm the appropriate commercial tier or written permission before serving Tej-derived data to multiple users in a public/commercial MarketDX deployment.
- BharatStock's published terms permit display/analysis inside an application for its own end users but prohibit reselling, re-serving, sublicensing or bulk-redistributing raw data.
- Upstox market-data usage is subject to the broker's API and exchange-data terms. Review the account's permissions before enabling public display.

Treat prices and derived analysis as informational; validate them against an appropriately licensed primary source before any trading or commercial use.
