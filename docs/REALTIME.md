# MarketDx Real-Time Integration

## WebSocket

Authenticated clients connect to `/api/v1/ws/market?token=<access-token>` through Nginx. The backend broadcasts normalized `market_tick` messages to connected clients.

## Webhook

POST broker events to `/api/v1/webhooks/broker` with `X-Webhook-Signature: sha256=<HMAC-SHA256>` when `WEBHOOK_SECRET` is configured. Payloads containing `symbol` and `price` are normalized into market ticks.

## Production provider adapter

`backend/app/services/market_stream.py` intentionally contains provider-neutral publishing logic. A broker-specific WebSocket/streaming adapter should consume the provider feed and call `market_stream.publish(...)`. Do not place broker API keys in the frontend.
