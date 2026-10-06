"""Бізнес-логіка заходів: перегляд, створення, редагування, скасування, статистика, експорт."""
import csv
import io
from collections import Counter

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Event, EventStatus, RegStatus, Role, User
from app.repositories import events as events_repo
from app.repositories import registrations as regs_repo
from app.schemas import DayCount, EventIn, EventOut, EventPatch, EventStatsOut, OrganizerOut


def to_out(db: Session, events: list[Event], me: User) -> list[EventOut]:
    """Формує відповіді для списку заходів, завантажуючи лічильники групувальними запитами."""
    ids = [e.id for e in events]
    cnt = events_repo.counts(db, ids)
    mine = regs_repo.my_map(db, me.id, ids)
    return [
        EventOut(
            id=e.id, title=e.title, description=e.description or "", location=e.location, start_at=e.start_at,
            end_at=e.end_at, capacity=e.capacity, status=e.status, category=e.category.name,
            organizer=OrganizerOut(id=e.organizer.id, full_name=e.organizer.full_name),
            registered=cnt[e.id][0], attended=cnt[e.id][1], hidden=e.is_hidden, my_registration_id=mine.get(e.id),
        )
        for e in events
    ]


def _can_manage(event: Event, me: User) -> bool:
    return event.organizer_id == me.id or me.role == Role.ADMIN


def get_visible(db: Session, event_id: int, me: User) -> Event:
    e = events_repo.get(db, event_id)
    if e is None or (e.is_hidden and not _can_manage(e, me)):
        raise AppError(404, "Захід не знайдено")
    return e


def list_events(db: Session, me: User, *, q: str, category: str, mine: bool, all_: bool, upcoming: bool) -> list[EventOut]:
    items = events_repo.search(db, q=q, category=category, organizer_id=me.id if mine else None,
                               include_hidden=all_ and me.role == Role.ADMIN, upcoming=upcoming)
    out = to_out(db, items, me)
    # майбутні – за зростанням дати, завершені – у кінці списку (від найновіших)
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    def key(o: EventOut):
        end = o.end_at if o.end_at.tzinfo else o.end_at.replace(tzinfo=timezone.utc)
        start = o.start_at if o.start_at.tzinfo else o.start_at.replace(tzinfo=timezone.utc)
        return (0, start.timestamp()) if end >= now else (1, -start.timestamp())

    return sorted(out, key=key)


def create(db: Session, me: User, data: EventIn) -> EventOut:
    if me.role not in (Role.ORGANIZER, Role.ADMIN):
        raise AppError(403, "Недостатньо прав для створення заходу")
    cat = events_repo.category_by_name(db, data.category)
    if cat is None:
        raise AppError(400, "Невідома категорія заходу")
    e = Event(title=data.title.strip(), description=data.description.strip(), location=data.location.strip(),
              start_at=data.start_at, end_at=data.end_at, capacity=data.capacity, category_id=cat.id, organizer_id=me.id)
    db.add(e)
    db.commit()
    db.refresh(e)
    return to_out(db, [e], me)[0]


def update(db: Session, me: User, event_id: int, data: EventPatch) -> EventOut:
    e = get_visible(db, event_id, me)
    if not _can_manage(e, me):
        raise AppError(403, "Редагувати можна лише власні заходи")
    fields = data.model_dump(exclude_unset=True)
    if me.role == Role.ADMIN and set(fields) == {"hidden"}:
        e.is_hidden = bool(fields["hidden"])  # модерація: приховування заходу
    else:
        if "hidden" in fields and me.role != Role.ADMIN:
            raise AppError(403, "Приховувати заходи може лише адміністратор")
        if "category" in fields and fields["category"] is not None:
            cat = events_repo.category_by_name(db, fields["category"])
            if cat is None:
                raise AppError(400, "Невідома категорія заходу")
            e.category_id = cat.id
            e.category = cat
        for k in ("title", "description", "location", "start_at", "end_at", "capacity"):
            if fields.get(k) is not None:
                setattr(e, k, fields[k].strip() if isinstance(fields[k], str) else fields[k])
        if "hidden" in fields and fields["hidden"] is not None:
            e.is_hidden = fields["hidden"]
        if e.end_at <= e.start_at:
            raise AppError(400, "Час завершення має бути пізніше за час початку")
        if e.capacity < regs_repo.active_count(db, e.id):
            raise AppError(409, "Місткість не може бути меншою за кількість реєстрацій")
    db.commit()
    return to_out(db, [e], me)[0]


def delete(db: Session, me: User, event_id: int) -> None:
    e = get_visible(db, event_id, me)
    if not _can_manage(e, me):
        raise AppError(403, "Недостатньо прав")
    if me.role == Role.ADMIN:
        for r in regs_repo.all_of_event(db, e.id):  # модерація: повне видалення разом із реєстраціями
            db.delete(r)
        db.delete(e)
    else:
        e.status = EventStatus.CANCELLED  # організатор лише скасовує захід
    db.commit()


def stats(db: Session, me: User, event_id: int) -> EventStatsOut:
    e = get_visible(db, event_id, me)
    registered, attended = events_repo.counts(db, [e.id])[e.id]
    days = Counter(r.registered_at.strftime("%d.%m") for r in sorted(regs_repo.active_of_event(db, e.id), key=lambda r: r.registered_at))
    by_day = [DayCount(label=k, value=v) for k, v in list(days.items())[-7:]]
    return EventStatsOut(capacity=e.capacity, registered=registered, attended=attended,
                         attendance_pct=round(100 * attended / registered) if registered else 0, by_day=by_day)


def export_csv(db: Session, me: User, event_id: int) -> str:
    e = get_visible(db, event_id, me)
    if not _can_manage(e, me):
        raise AppError(403, "Експорт доступний лише організатору заходу")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["ПІБ", "Email", "Дата реєстрації", "Присутній"])
    for r in regs_repo.active_of_event(db, e.id):
        w.writerow([r.user.full_name, r.user.email, r.registered_at.isoformat(), "так" if r.check_in else "ні"])
    return buf.getvalue()
