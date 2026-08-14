import hashlib
import hmac
import json

from fastapi.testclient import TestClient


def test_broker_webhook_rejects_bad_signature(monkeypatch):
    from app.main import app
    from app.core import config

    monkeypatch.setattr(config.settings, "ENV", "production")
    monkeypatch.setattr(config.settings, "WEBHOOK_SECRET", "test-secret")

    client = TestClient(app)
    response = client.post(
        "/api/v1/webhooks/broker",
        content=json.dumps({"symbol": "NIFTY", "price": 25000}),
        headers={"x-webhook-signature": "sha256=invalid"},
    )
    assert response.status_code == 401


def test_broker_webhook_accepts_valid_signature(monkeypatch):
    from app.main import app
    from app.core import config

    monkeypatch.setattr(config.settings, "ENV", "production")
    monkeypatch.setattr(config.settings, "WEBHOOK_SECRET", "test-secret")

    body = json.dumps({"symbol": "NIFTY", "price": 25000}).encode()
    signature = hmac.new(b"test-secret", body, hashlib.sha256).hexdigest()

    client = TestClient(app)
    response = client.post(
        "/api/v1/webhooks/broker",
        content=body,
        headers={"x-webhook-signature": f"sha256={signature}"},
    )
    assert response.status_code == 200
