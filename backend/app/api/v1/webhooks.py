import hashlib
import hmac
import json

from fastapi import APIRouter, Header, HTTPException, Request

from app.core.config import settings
from app.services.websocket_manager import manager

router = APIRouter()


def _verify_signature(raw_body: bytes, signature: str | None) -> bool:
    secret = settings.WEBHOOK_SECRET
    if not secret:
        return settings.ENV != "production"
    if not signature:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    provided = signature.removeprefix("sha256=")
    return hmac.compare_digest(expected, provided)


@router.post("/broker")
async def broker_webhook(
    request: Request,
    x_webhook_signature: str | None = Header(default=None),
):
    raw_body = await request.body()
    if not _verify_signature(raw_body, x_webhook_signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    await manager.broadcast({"type": "broker_event", "data": payload})
    return {"status": "accepted"}
