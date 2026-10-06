"""Рівень доступу до даних: реєстрації."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import RegStatus, Registration


def find(db: Session, event_id: int, user_id: int) -> Registration | None:
    return db.scalar(select(Registration).where(Registration.event_id == event_id, Registration.user_id == user_id))


def by_id(db: Session, reg_id: int) -> Registration | None:
    return db.get(Registration, reg_id)


def by_token(db: Session, token: str) -> Registration | None:
    return db.scalar(select(Registration).where(Registration.qr_token == token))


def active_count(db: Session, event_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Registration).where(
        Registration.event_id == event_id, Registration.status == RegStatus.ACTIVE)) or 0


def of_user(db: Session, user_id: int) -> list[Registration]:
    return list(db.scalars(select(Registration).where(Registration.user_id == user_id)
                           .order_by(Registration.id.desc())).unique())


def active_of_event(db: Session, event_id: int) -> list[Registration]:
    return list(db.scalars(select(Registration).where(
        Registration.event_id == event_id, Registration.status == RegStatus.ACTIVE)).unique())


def my_map(db: Session, user_id: int, event_ids: list[int]) -> dict[int, int]:
    """event_id → id активної реєстрації користувача."""
    if not event_ids:
        return {}
    rows = db.execute(select(Registration.event_id, Registration.id).where(
        Registration.user_id == user_id, Registration.event_id.in_(event_ids),
        Registration.status == RegStatus.ACTIVE)).all()
    return dict(rows)


def all_of_event(db: Session, event_id: int) -> list[Registration]:
    return list(db.scalars(select(Registration).where(Registration.event_id == event_id)).unique())
