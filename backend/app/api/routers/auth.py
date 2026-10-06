"""Маршрути автентифікації та службові ендпоінти."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.repositories import events as events_repo
from app.schemas import AuthOut, LoginIn, RegisterIn, UserOut
from app.services import auth as auth_service

router = APIRouter(tags=["Автентифікація"])
service_router = APIRouter(tags=["Службові"])


@router.post("/auth/register", response_model=AuthOut, status_code=201, summary="Реєстрація користувача")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    return auth_service.register(db, data)


@router.post("/auth/login", response_model=AuthOut, summary="Вхід (отримання JWT)")
def login(data: LoginIn, db: Session = Depends(get_db)):
    return auth_service.login(db, data)


@router.get("/users/me", response_model=UserOut, summary="Поточний користувач")
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/categories", response_model=list[str], summary="Категорії заходів")
def categories(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return events_repo.category_names(db)


@service_router.get("/health", summary="Перевірка працездатності")
def health(db: Session = Depends(get_db)):
    """Використовується хостингом і клієнтом, щоб переконатися, що сервер і БД доступні."""
    db.execute(text("SELECT 1"))
    return {"status": "ok", "service": "edureg-api", "version": "1.0.0", "database": "ok"}
