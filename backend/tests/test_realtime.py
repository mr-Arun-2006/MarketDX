import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


def test_websocket_requires_authentication():
    from app.main import app

    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/v1/ws/market") as websocket:
            websocket.receive_json()
