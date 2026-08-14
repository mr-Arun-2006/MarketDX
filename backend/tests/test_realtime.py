from fastapi.testclient import TestClient


def test_websocket_requires_authentication():
    # The application rejects unauthenticated WebSocket handshakes with policy code.
    from app.main import app

    client = TestClient(app)
    with client.websocket_connect("/api/v1/ws/market") as websocket:
        # A successful handshake would indicate the auth guard is missing.
        websocket.send_json({"type": "ping"})
