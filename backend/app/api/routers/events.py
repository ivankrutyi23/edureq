"""Маршрути заходів: CRUD, реєстрації на захід, статистика, експорт."""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import Role, User
from app.schemas import EventIn, EventOut, EventPatch, EventStatsOut, RegistrationOut
from app.services import events as events_service
from app.services import registrations as regs_service

router = APIRouter(tags=["Заходи"])


@router.get("/events", response_model=list[EventOut], summary="Список заходів (пошук і фільтри)")
def list_events(
    q: str = Query("", max_length=100, description="Пошук за назвою або місцем"),
    category: str = Query("", max_length=50),
    mine: bool = Query(False, description="Лише заходи поточного організатора"),
    all: bool = Query(False, description="Адміністратор: включно з прихованими"),
    upcoming: bool = Query(False, description="Лише майбутні опубліковані"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return events_service.list_events(db, user, q=q.strip(), category=category, mine=mine, all_=all, upcoming=upcoming)


@router.post("/events", response_model=EventOut, status_code=201, summary="Створення заходу")
def create_event(data: EventIn, user: User = Depends(require_roles(Role.ORGANIZER, Role.ADMIN)), db: Session = Depends(get_db)):
    return events_service.create(db, user, data)


@router.get("/events/{event_id}", response_model=EventOut, summary="Інформація про захід")
def get_event(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    e = events_service.get_visible(db, event_id, user)
    return events_service.to_out(db, [e], user)[0]


@router.patch("/events/{event_id}", response_model=EventOut, summary="Редагування / модерація заходу")
def patch_event(event_id: int, data: EventPatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return events_service.update(db, user, event_id, data)


@router.delete("/events/{event_id}", summary="Скасування (організатор) або видалення (адміністратор)")
def delete_event(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    events_service.delete(db, user, event_id)
    return {"ok": True}


@router.post("/events/{event_id}/registrations", response_model=RegistrationOut, status_code=201,
             summary="Реєстрація на захід")
def register_for_event(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return regs_service.register(db, user, event_id)


@router.get("/events/{event_id}/registrations", response_model=list[RegistrationOut], summary="Учасники заходу")
def event_registrations(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return regs_service.of_event(db, user, event_id)


@router.get("/events/{event_id}/stats", response_model=EventStatsOut, summary="Статистика відвідуваності")
def event_stats(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return events_service.stats(db, user, event_id)


@router.get("/events/{event_id}/export", response_class=PlainTextResponse, summary="Експорт учасників (CSV)")
def event_export(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return PlainTextResponse(events_service.export_csv(db, user, event_id), media_type="text/csv; charset=utf-8")
