"""Налаштування тестів: окрема in-memory БД SQLite, швидкі bcrypt-раунди, допоміжні фікстури."""
import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["BCRYPT_ROUNDS"] = "4"
os.environ["SEED_DEMO"] = "false"
os.environ["SECRET_KEY"] = "test-secret"

from datetime import datetime, timedelta, timezone  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.session import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Category, Role, User  # noqa: E402

PASSWORD = "Secret123"


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add_all([Category(name="Лекція"), Category(name="Семінар")])
        db.commit()
    with TestClient(app) as c:
        yield c


def make_user(email: str, role: Role = Role.PARTICIPANT, name: str = "Тест Користувач", active: bool = True) -> int:
    with SessionLocal() as db:
        u = User(full_name=name, email=email, password_hash=hash_password(PASSWORD), role=role, is_active=active)
        db.add(u)
        db.commit()
        return u.id


def login(client: TestClient, email: str) -> dict:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture()
def org(client):
    make_user("org@t.test", Role.ORGANIZER, "Організатор Один")
    return login(client, "org@t.test")


@pytest.fixture()
def org2(client):
    make_user("org2@t.test", Role.ORGANIZER, "Організатор Два")
    return login(client, "org2@t.test")


@pytest.fixture()
def admin(client):
    make_user("admin@t.test", Role.ADMIN, "Адмін")
    return login(client, "admin@t.test")


@pytest.fixture()
def user(client):
    make_user("p1@t.test", name="Учасник Один")
    return login(client, "p1@t.test")


def event_payload(**kw):
    start = datetime.now(timezone.utc) + timedelta(days=3)
    base = {
        "title": "Тестовий захід", "description": "Опис", "location": "Ауд. 1",
        "startAt": start.isoformat(), "endAt": (start + timedelta(hours=2)).isoformat(),
        "capacity": 2, "category": "Лекція",
    }
    base.update(kw)
    return base


@pytest.fixture()
def event(client, org):
    r = client.post("/api/v1/events", json=event_payload(), headers=org)
    assert r.status_code == 201, r.text
    return r.json()
