"""Підтвердження присутності (check-in) за QR-кодом або вручну."""
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import CheckIn, CheckInMethod, RegStatus, Registration, Role, User
from app.repositories import registrations as regs_repo
from app.schemas import CheckInIn, CheckInOut


def _mark(db: Session, reg: Registration, me: User, method: CheckInMethod) -> CheckInOut:
    name = reg.user.full_name
    if reg.status != RegStatus.ACTIVE:
        return CheckInOut(ok=False, reason="CANCELLED", full_name=name)
    if reg.check_in:  # один квиток – один вхід
        return CheckInOut(ok=False, reason="USED", full_name=name, at=reg.check_in.checked_in_at)
    ci = CheckIn(registration_id=reg.id, checked_by_id=me.id, method=method)
    db.add(ci)
    db.commit()
    db.refresh(ci)
    return CheckInOut(ok=True, full_name=name, at=ci.checked_in_at)


def _require_staff(me: User) -> None:
    if me.role == Role.PARTICIPANT:
        raise AppError(403, "Check-in доступний лише організатору")


def by_qr(db: Session, me: User, data: CheckInIn) -> CheckInOut:
    _require_staff(me)
    reg = regs_repo.by_token(db, data.qr_token)
    if reg is None:
        return CheckInOut(ok=False, reason="INVALID")
    if data.event_id is not None and data.event_id != reg.event_id:
        return CheckInOut(ok=False, reason="OTHER_EVENT", full_name=reg.user.full_name)
    if reg.event.organizer_id != me.id and me.role != Role.ADMIN:
        raise AppError(403, "Це не ваш захід")
    return _mark(db, reg, me, CheckInMethod.QR)


def manual(db: Session, me: User, reg_id: int) -> CheckInOut:
    _require_staff(me)
    reg = regs_repo.by_id(db, reg_id)
    if reg is None:
        raise AppError(404, "Реєстрацію не знайдено")
    if reg.event.organizer_id != me.id and me.role != Role.ADMIN:
        raise AppError(403, "Це не ваш захід")
    return _mark(db, reg, me, CheckInMethod.MANUAL)
