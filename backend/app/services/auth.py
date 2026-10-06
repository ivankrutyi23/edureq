"""Автентифікація: реєстрація, вхід, блокування після невдалих спроб, аудит подій."""
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Role, User
from app.repositories import users as users_repo
from app.schemas import AuthOut, LoginIn, RegisterIn, UserOut

audit = logging.getLogger("edureg.audit")  # журнал подій безпеки

_DUMMY_HASH = hash_password("dummy-password-1")  # для однакового часу відповіді, якщо користувача немає


def _out(user: User) -> AuthOut:
    return AuthOut(token=create_access_token(user.id, user.role.value), user=UserOut.model_validate(user))


def register(db: Session, data: RegisterIn) -> AuthOut:
    if users_repo.by_email(db, data.email):
        raise AppError(409, "Користувач із такою поштою вже існує")
    user = User(full_name=data.full_name, email=data.email, password_hash=hash_password(data.password), role=Role.PARTICIPANT)
    try:
        users_repo.add(db, user)
        db.commit()
    except IntegrityError:  # гонка двох одночасних реєстрацій з однією поштою
        db.rollback()
        raise AppError(409, "Користувач із такою поштою вже існує")
    audit.info("register user=%s", user.id)
    return _out(user)


def login(db: Session, data: LoginIn) -> AuthOut:
    s = get_settings()
    now = datetime.now(timezone.utc)
    user = users_repo.by_email(db, data.email)
    if user is None:
        verify_password(data.password, _DUMMY_HASH)  # не розкриваємо, чи існує така пошта
        audit.warning("login_failed unknown_email")
        raise AppError(401, "Неправильна пошта або пароль")

    locked = user.locked_until
    if locked is not None:
        if locked.tzinfo is None:
            locked = locked.replace(tzinfo=timezone.utc)
        if locked > now:
            audit.warning("login_blocked user=%s", user.id)
            raise AppError(403, f"Забагато невдалих спроб. Спробуйте знову після {locked.strftime('%H:%M')} (UTC)")

    if not verify_password(data.password, user.password_hash):
        user.failed_attempts += 1
        if user.failed_attempts >= s.max_failed_attempts:
            user.locked_until = now + timedelta(minutes=s.lockout_minutes)
            user.failed_attempts = 0
            audit.warning("account_locked user=%s", user.id)
        db.commit()
        raise AppError(401, "Неправильна пошта або пароль")

    if not user.is_active:
        raise AppError(403, "Обліковий запис заблоковано адміністратором")
    user.failed_attempts = 0
    user.locked_until = None
    db.commit()
    audit.info("login user=%s role=%s", user.id, user.role.value)
    return _out(user)
