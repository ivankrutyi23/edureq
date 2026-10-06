"""Бізнес-логіка реєстрацій: реєстрація на захід, скасування, перегляд."""
import secrets
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import EventStatus, RegStatus, Registration, Role, User
from app.repositories import events as events_repo
from app.repositories import registrations as regs_repo
from app.schemas import EventOut, RegistrationOut, RegUserOut
from app.services import events as events_service


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def new_token() -> str:
    """Криптографічно стійкий QR-токен: 128 біт випадковості, без персональних даних (NFR-07)."""
    return "EDU-" + secrets.token_hex(16).upper()


def to_out(db: Session, reg: Registration, me: User, with_event: bool = False, with_user: bool = False) -> RegistrationOut:
    out = RegistrationOut(
        id=reg.id, event_id=reg.event_id, user_id=reg.user_id, status=reg.status, registered_at=reg.registered_at,
        qr_token=reg.qr_token, checked_in_at=reg.check_in.checked_in_at if reg.check_in else None,
    )
    if with_event:
        out.event = events_service.to_out(db, [reg.event], me)[0]
    if with_user:
        out.user = RegUserOut(id=reg.user.id, full_name=reg.user.full_name, email=reg.user.email)
    return out


def register(db: Session, me: User, event_id: int) -> RegistrationOut:
    """Реєстрація на захід. Рядок заходу блокується, тому місткість не буде перевищена
    навіть за одночасних запитів (NFR-08)."""
    event = events_repo.get(db, event_id, lock=True)
    if event is None or event.is_hidden:
        raise AppError(404, "Захід не знайдено")
    if event.status != EventStatus.PUBLISHED or _aware(event.start_at) < datetime.now(timezone.utc):
        raise AppError(409, "Реєстрація на цей захід закрита")
    existing = regs_repo.find(db, event_id, me.id)
    if existing and existing.status == RegStatus.ACTIVE:
        raise AppError(409, "Ви вже зареєстровані на цей захід")
    if regs_repo.active_count(db, event_id) >= event.capacity:
        raise AppError(409, "Вільних місць більше немає")
    if existing:  # повторна реєстрація після скасування відновлює запис (UNIQUE event_id + user_id)
        existing.status = RegStatus.ACTIVE
        existing.qr_token = new_token()
        existing.registered_at = datetime.now(timezone.utc)
        reg = existing
    else:
        reg = Registration(event_id=event_id, user_id=me.id, status=RegStatus.ACTIVE, qr_token=new_token())
        db.add(reg)
    db.commit()
    db.refresh(reg)
    return to_out(db, reg, me, with_event=True)


def cancel(db: Session, me: User, reg_id: int) -> RegistrationOut:
    reg = regs_repo.by_id(db, reg_id)
    if reg is None or reg.user_id != me.id:
        raise AppError(404, "Реєстрацію не знайдено")
    if _aware(reg.event.start_at) < datetime.now(timezone.utc):
        raise AppError(409, "Захід уже розпочався, скасування неможливе")
    if reg.check_in:
        raise AppError(409, "Присутність уже підтверджено")
    reg.status = RegStatus.CANCELLED
    db.commit()
    return to_out(db, reg, me, with_event=True)


def mine(db: Session, me: User) -> list[RegistrationOut]:
    return [to_out(db, r, me, with_event=True) for r in regs_repo.of_user(db, me.id)]


def of_event(db: Session, me: User, event_id: int) -> list[RegistrationOut]:
    event = events_service.get_visible(db, event_id, me)
    if event.organizer_id != me.id and me.role != Role.ADMIN:
        raise AppError(403, "Список доступний лише організатору")
    items = [to_out(db, r, me, with_user=True) for r in regs_repo.active_of_event(db, event.id)]
    return sorted(items, key=lambda x: x.user.full_name)
