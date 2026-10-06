"""Адміністрування користувачів."""
import logging

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import User
from app.repositories import users as users_repo
from app.schemas import UserOut, UserPatch

audit = logging.getLogger("edureg.audit")


def list_users(db: Session) -> list[UserOut]:
    return [UserOut.model_validate(u) for u in users_repo.list_all(db)]


def patch_user(db: Session, me: User, user_id: int, data: UserPatch) -> UserOut:
    user = users_repo.by_id(db, user_id)
    if user is None:
        raise AppError(404, "Користувача не знайдено")
    if user.id == me.id:
        raise AppError(409, "Не можна змінювати власний обліковий запис")
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.role is not None:
        user.role = data.role
    db.commit()
    audit.info("admin=%s changed user=%s active=%s role=%s", me.id, user.id, user.is_active, user.role.value)
    return UserOut.model_validate(user)
