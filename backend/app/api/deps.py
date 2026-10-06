"""Залежності FastAPI: поточний користувач і перевірка ролей (авторизація)."""
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import decode_token
from app.db.session import get_db
from app.models import Role, User
from app.repositories import users as users_repo

bearer = HTTPBearer(auto_error=False, description="JWT, отриманий через POST /auth/login")


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    """Автентифікація: перевіряє підпис і термін дії токена та стан облікового запису."""
    if creds is None:
        raise AppError(401, "Потрібно увійти в систему")
    payload = decode_token(creds.credentials)
    if payload is None:
        raise AppError(401, "Сесія недійсна або завершилась. Увійдіть знову")
    user = users_repo.by_id(db, int(payload["sub"]))
    if user is None or not user.is_active:
        raise AppError(401, "Обліковий запис недоступний")
    return user


def require_roles(*roles: Role):
    """Авторизація: пропускає лише користувачів із зазначеними ролями."""

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise AppError(403, "Недостатньо прав для цієї дії")
        return user

    return checker
