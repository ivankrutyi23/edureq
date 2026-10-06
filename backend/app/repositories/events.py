"""Рівень доступу до даних: заходи та категорії."""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Category, CheckIn, Event, EventStatus, RegStatus, Registration


def get(db: Session, event_id: int, lock: bool = False) -> Event | None:
    """lock=True блокує рядок заходу (SELECT … FOR UPDATE) на час транзакції реєстрації."""
    stmt = select(Event).where(Event.id == event_id)
    if lock:
        stmt = stmt.with_for_update(of=Event)
    return db.scalar(stmt)


def search(db: Session, *, q: str = "", category: str = "", organizer_id: int | None = None,
           include_hidden: bool = False, upcoming: bool = False) -> list[Event]:
    stmt = select(Event).join(Category)
    if not include_hidden:
        stmt = stmt.where(Event.is_hidden.is_(False))
    if organizer_id is not None:
        stmt = stmt.where(Event.organizer_id == organizer_id)
    if category:
        stmt = stmt.where(Category.name == category)
    if upcoming:
        stmt = stmt.where(Event.status == EventStatus.PUBLISHED, Event.end_at > datetime.now(timezone.utc))
    items = list(db.scalars(stmt).unique())
    if q:  # регістронезалежний пошук кирилиці виконуємо на рівні Python (однаково для PostgreSQL і SQLite)
        needle = q.casefold()
        items = [e for e in items if needle in e.title.casefold() or needle in e.location.casefold()]
    return items


def counts(db: Session, event_ids: list[int]) -> dict[int, tuple[int, int]]:
    """Кількість активних реєстрацій і присутніх для кожного заходу (двома запитами, без N+1)."""
    if not event_ids:
        return {}
    reg = dict(db.execute(
        select(Registration.event_id, func.count()).where(
            Registration.event_id.in_(event_ids), Registration.status == RegStatus.ACTIVE
        ).group_by(Registration.event_id)).all())
    att = dict(db.execute(
        select(Registration.event_id, func.count()).join(CheckIn, CheckIn.registration_id == Registration.id)
        .where(Registration.event_id.in_(event_ids)).group_by(Registration.event_id)).all())
    return {i: (reg.get(i, 0), att.get(i, 0)) for i in event_ids}


def category_by_name(db: Session, name: str) -> Category | None:
    return db.scalar(select(Category).where(Category.name == name))


def category_names(db: Session) -> list[str]:
    return list(db.scalars(select(Category.name).order_by(Category.id)))
