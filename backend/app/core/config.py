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
    EOD_DATA_PROVIDER: str = "tej"
    BHARATSTOCK_API_KEY: str = ""
    LIVE_DATA_PROVIDER: str = "upstox"
    UPSTOX_ACCESS_TOKEN: str = ""
    UPSTOX_INSTRUMENT_KEYS: str = "NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,BSE_INDEX|SENSEX"
    WEBHOOK_SECRET: str = ""

    ALLOWED_ORIGINS: List[str] = ["http://localhost", "http://localhost:3000"]

    class Config:
        env_file = ".env"

settings = Settings()
