"""Схеми запитів і відповідей (Pydantic). JSON використовує camelCase, як і клієнт."""
import re
from datetime import datetime, timezone
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, PlainSerializer, field_validator, model_validator
from pydantic.alias_generators import to_camel

from app.models import EventStatus, RegStatus, Role


def _utc(dt: datetime) -> str:
    """Дата завжди повертається в UTC із суфіксом Z (SQLite втрачає часову зону)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


UTCDateTime = Annotated[datetime, PlainSerializer(_utc, return_type=str)]


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------------------------------------------------------------- користувачі
class UserOut(Camel):
    id: int
    full_name: str
    email: str
    role: Role
    is_active: bool
    created_at: UTCDateTime


class RegisterIn(Camel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("full_name")
    @classmethod
    def _name(cls, v: str) -> str:
        return v.strip()

    @field_validator("password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        # політика паролів: щонайменше одна літера та одна цифра
        if not re.search(r"[A-Za-zА-Яа-яІіЇїЄєҐґ]", v) or not re.search(r"\d", v):
            raise ValueError("пароль має містити літери та цифри")
        return v


class LoginIn(Camel):
    email: str
    password: str


class AuthOut(Camel):
    token: str
    user: UserOut


class UserPatch(Camel):
    is_active: Optional[bool] = None
    role: Optional[Role] = None


# ---------------------------------------------------------------------- заходи
class OrganizerOut(Camel):
    id: int
    full_name: str


class EventIn(Camel):
    title: str = Field(min_length=3, max_length=150)
    description: str = Field(default="", max_length=5000)
    location: str = Field(min_length=1, max_length=150)
    start_at: datetime
    end_at: datetime
    capacity: int = Field(ge=1, le=5000)
    category: str

    @model_validator(mode="after")
    def _dates(self):
        if self.end_at <= self.start_at:
            raise ValueError("час завершення має бути пізніше за час початку")
        return self


class EventPatch(Camel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=150)
    description: Optional[str] = Field(default=None, max_length=5000)
    location: Optional[str] = Field(default=None, min_length=1, max_length=150)
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    capacity: Optional[int] = Field(default=None, ge=1, le=5000)
    category: Optional[str] = None
    hidden: Optional[bool] = None


class EventOut(Camel):
    id: int
    title: str
    description: str
    location: str
    start_at: UTCDateTime
    end_at: UTCDateTime
    capacity: int
    status: EventStatus
    category: str
    organizer: OrganizerOut
    registered: int
    attended: int
    hidden: bool
    my_registration_id: Optional[int] = None


class DayCount(Camel):
    label: str
    value: int


class EventStatsOut(Camel):
    capacity: int
    registered: int
    attended: int
    attendance_pct: int
    by_day: list[DayCount]


# ------------------------------------------------------------------ реєстрації
class RegUserOut(Camel):
    id: int
    full_name: str
    email: str


class RegistrationOut(Camel):
    id: int
    event_id: int
    user_id: int
    status: RegStatus
    registered_at: UTCDateTime
    qr_token: str
    checked_in_at: Optional[UTCDateTime] = None
    event: Optional[EventOut] = None
    user: Optional[RegUserOut] = None


class CheckInIn(Camel):
    qr_token: str = Field(min_length=1, max_length=64)
    event_id: Optional[int] = None


class CheckInOut(Camel):
    ok: bool
    full_name: Optional[str] = None
    reason: Optional[str] = None  # INVALID | USED | CANCELLED | OTHER_EVENT
    at: Optional[UTCDateTime] = None
