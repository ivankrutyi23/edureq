"""Налаштування застосунку. Значення беруться зі змінних середовища (або файлу .env)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./edureg.db"
    secret_key: str = "dev-secret-change-me-in-production"
    access_token_minutes: int = 60
    cors_origins: str = "http://localhost:5173,http://localhost:4173,https://ivankrutyi23.github.io"
    seed_demo: bool = True

    # політика безпеки облікових записів
    bcrypt_rounds: int = 12
    max_failed_attempts: int = 5
    lockout_minutes: int = 15

    @property
    def sqlalchemy_url(self) -> str:
        """Render віддає postgres://…, а SQLAlchemy потребує явного драйвера."""
        url = self.database_url
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg2://" + url[len(prefix):]
        return url

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
