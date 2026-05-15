from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from pydantic import BaseModel
from app.core.deps import require_admin
from app.core.database import get_db
from app.core.security import hash_password
from app.models.models import User, UserRole, MarketHealthScore

router = APIRouter()

# ── User Management ───────────────────────────────────────────
@router.get("/users")
async def list_users(admin=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [{"id": u.id, "full_name": u.full_name, "email": u.email,
             "role": u.role, "is_active": u.is_active, "created_at": u.created_at,
             "last_login": u.last_login} for u in users]

@router.get("/stats")
async def platform_stats(admin=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    total_users = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.USER))
    active_users = await db.scalar(select(func.count(User.id)).where(User.is_active == True, User.role == UserRole.USER))
    total_admins = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.ADMIN))
    return {
        "total_users": total_users or 0,
        "active_users": active_users or 0,
        "total_admins": total_admins or 0,
        "platform": "Market Diagnosis Platform v1.0",
    }

class ToggleUser(BaseModel):
    is_active: bool

@router.patch("/users/{user_id}/toggle")
async def toggle_user(user_id: int, body: ToggleUser, admin=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    await db.execute(update(User).where(User.id == user_id).values(is_active=body.is_active))
    await db.commit()
    return {"message": f"User {user_id} {'activated' if body.is_active else 'deactivated'}"}

class CreateAdminRequest(BaseModel):
    full_name: str
    email: str
    password: str

@router.post("/create-admin", status_code=201)
async def create_admin(req: CreateAdminRequest, admin=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    new_admin = User(full_name=req.full_name, email=req.email,
                     hashed_password=hash_password(req.password), role=UserRole.ADMIN, is_active=True)
    db.add(new_admin)
    await db.commit()
    return {"message": "Admin created", "email": req.email}
