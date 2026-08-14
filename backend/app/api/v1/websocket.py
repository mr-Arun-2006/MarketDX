from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.websocket_manager import manager

router = APIRouter()


@router.websocket("/ws/market")
async def market_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive and allow clients to send control messages.
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
