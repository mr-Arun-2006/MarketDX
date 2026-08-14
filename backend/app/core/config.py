from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    ENV: str = "production"
    SECRET_KEY: str = "change_me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    DATABASE_URL: str = "postgresql+asyncpg://mdp_user:mdp_pass@postgres:5432/market_diagnosis"
    REDIS_URL: str = "redis://:redis_pass@redis:6379/0"

    GEMINI_API_KEY: str = ""
    ALPHA_VANTAGE_KEY: str = ""
    WEBHOOK_SECRET: str = ""

    ALLOWED_ORIGINS: List[str] = ["http://localhost", "http://localhost:3000"]

    class Config:
        env_file = ".env"

settings = Settings()
