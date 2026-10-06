"""Маршрути реєстрацій, check-in та адміністрування."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import Role, User
from app.schemas import CheckInIn, CheckInOut, RegistrationOut, UserOut, UserPatch
from app.services import admin as admin_service
from app.services import checkin as checkin_service
from app.services import registrations as regs_service

router = APIRouter()


@router.get("/registrations/my", response_model=list[RegistrationOut], tags=["Реєстрації"], summary="Мої реєстрації")
def my_registrations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return regs_service.mine(db, user)


@router.delete("/registrations/{reg_id}", response_model=RegistrationOut, tags=["Реєстрації"],
               summary="Скасування реєстрації")
def cancel_registration(reg_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return regs_service.cancel(db, user, reg_id)


@router.post("/checkin", response_model=CheckInOut, tags=["Check-in"], summary="Check-in за QR-токеном")
def check_in(data: CheckInIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return checkin_service.by_qr(db, user, data)


@router.post("/registrations/{reg_id}/checkin", response_model=CheckInOut, tags=["Check-in"],
             summary="Ручне відмічання присутності")
def manual_check_in(reg_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return checkin_service.manual(db, user, reg_id)


@router.get("/admin/users", response_model=list[UserOut], tags=["Адміністрування"], summary="Список користувачів")
def admin_users(_: User = Depends(require_roles(Role.ADMIN)), db: Session = Depends(get_db)):
    return admin_service.list_users(db)


@router.patch("/admin/users/{user_id}", response_model=UserOut, tags=["Адміністрування"],
              summary="Зміна ролі / блокування користувача")
def admin_patch_user(user_id: int, data: UserPatch, admin: User = Depends(require_roles(Role.ADMIN)),
                     db: Session = Depends(get_db)):
    return admin_service.patch_user(db, admin, user_id, data)
