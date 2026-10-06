"""ORM-моделі. Відповідають структурі БД з лабораторної роботи № 5."""
import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    PARTICIPANT = "PARTICIPANT"
    ORGANIZER = "ORGANIZER"
    ADMIN = "ADMIN"


class EventStatus(str, enum.Enum):
    PUBLISHED = "PUBLISHED"
    CANCELLED = "CANCELLED"
    FINISHED = "FINISHED"


class RegStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    CANCELLED = "CANCELLED"


class CheckInMethod(str, enum.Enum):
    QR = "QR"
    MANUAL = "MANUAL"


def _enum(e):  # VARCHAR + CHECK: однаково працює в PostgreSQL та SQLite
    return Enum(e, native_enum=False, length=20)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(_enum(Role), default=Role.PARTICIPANT)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint("capacity > 0", name="chk_event_capacity"),
        CheckConstraint("end_at > start_at", name="chk_event_dates"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String(150))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    capacity: Mapped[int] = mapped_column(Integer)
    status: Mapped[EventStatus] = mapped_column(_enum(EventStatus), default=EventStatus.PUBLISHED)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)  # приховано модератором
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    organizer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    category: Mapped[Category] = relationship(lazy="joined")
    organizer: Mapped[User] = relationship(lazy="joined")


class Registration(Base):
    __tablename__ = "registrations"
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_registration"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[RegStatus] = mapped_column(_enum(RegStatus), default=RegStatus.ACTIVE)
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    qr_token: Mapped[str] = mapped_column(String(64), unique=True)

    event: Mapped[Event] = relationship(lazy="joined")
    user: Mapped[User] = relationship(lazy="joined")
    check_in: Mapped["CheckIn | None"] = relationship(back_populates="registration", uselist=False, lazy="joined",
                                                      cascade="all, delete-orphan")


class CheckIn(Base):
    __tablename__ = "check_ins"

    id: Mapped[int] = mapped_column(primary_key=True)
    registration_id: Mapped[int] = mapped_column(ForeignKey("registrations.id", ondelete="CASCADE"), unique=True)
    checked_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    checked_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    method: Mapped[CheckInMethod] = mapped_column(_enum(CheckInMethod), default=CheckInMethod.QR)

    registration: Mapped[Registration] = relationship(back_populates="check_in")
