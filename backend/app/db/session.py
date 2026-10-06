"""Підключення до бази даних (SQLAlchemy). Працює з PostgreSQL (продакшн) і SQLite (тести)."""
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str):
    if url.startswith("sqlite"):
        kw = {"connect_args": {"check_same_thread": False}}
        if ":memory:" in url or url in ("sqlite://", "sqlite:///"):
            kw["poolclass"] = StaticPool  # одна спільна in-memory база для всіх з'єднань
        return create_engine(url, **kw)
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)


engine = make_engine(get_settings().sqlalchemy_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Залежність FastAPI: сесія на один запит; транзакція завершується після відповіді."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
