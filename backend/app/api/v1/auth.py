"""
Auth Endpoints — completely separate flows for User and Admin
POST /api/v1/auth/user/signup
POST /api/v1/auth/user/login
POST /api/v1/auth/admin/login      ← admins cannot self-register
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
"""
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, EmailStr
from datetime import datetime
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.deps import get_current_user
from app.models.models import User, UserRole

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────
class SignupRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

# ── User Signup ───────────────────────────────────────────────
@router.post("/user/signup", status_code=201)
async def user_signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        full_name=req.full_name,
        email=req.email,
        hashed_password=hash_password(req.password),
        role=UserRole.USER,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"message": "Account created successfully", "user_id": user.id}

# ── User Login ────────────────────────────────────────────────
@router.post("/user/login")
async def user_login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email, User.role == UserRole.USER))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    await db.execute(update(User).where(User.id == user.id).values(last_login=datetime.utcnow()))
    await db.commit()
    return {
        "access_token": create_access_token({"sub": user.id, "role": user.role}),
        "refresh_token": create_refresh_token({"sub": user.id, "role": user.role}),
        "token_type": "bearer",
        "role": user.role,
        "full_name": user.full_name,
    }

# ── Admin Login (no signup — admins seeded in DB) ─────────────
@router.post("/admin/login")
async def admin_login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email, User.role == UserRole.ADMIN))
    admin = result.scalar_one_or_none()
    if not admin or not verify_password(req.password, admin.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    await db.execute(update(User).where(User.id == admin.id).values(last_login=datetime.utcnow()))
    await db.commit()
    return {
        "access_token": create_access_token({"sub": admin.id, "role": admin.role}),
        "refresh_token": create_refresh_token({"sub": admin.id, "role": admin.role}),
        "token_type": "bearer",
        "role": admin.role,
        "full_name": admin.full_name,
    }

# ── Token Refresh ─────────────────────────────────────────────
@router.post("/refresh")
async def refresh_token(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(req.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    result = await db.execute(select(User).where(User.id == payload.get("sub")))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "access_token": create_access_token({"sub": user.id, "role": user.role}),
        "token_type": "bearer",
    }

# ── Me ────────────────────────────────────────────────────────
@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "full_name": user.full_name, "email": user.email,
            "role": user.role, "is_active": user.is_active, "created_at": user.created_at}
