from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import jwt, JWTError
from app.core.config import settings
from app.core.security import ALGORITHM
from app.services.websocket_manager import manager

router = APIRouter()


def _valid_access_token(token: str | None) -> bool:
    if not token:
        return False
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("type") == "access" and bool(payload.get("sub"))
    except JWTError:
        return False


@router.websocket("/ws/market")
async def market_websocket(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not _valid_access_token(token):
        await websocket.close(code=1008, reason="Authentication required")
        return

    await manager.connect(websocket)
    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
