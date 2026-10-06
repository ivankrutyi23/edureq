"""Рівень доступу до даних: користувачі."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User


def by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.strip().lower()))


def list_all(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id)))


def add(db: Session, user: User) -> User:
    user.email = user.email.strip().lower()
    db.add(user)
    db.flush()
    return user
