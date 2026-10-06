"""Початкові демонстраційні дані (ті самі, що й у демо-режимі фронтенду). Пароль усіх – demo1234."""
import random
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Category, CheckIn, CheckInMethod, Event, EventStatus, RegStatus, Registration, Role, User

DEMO_PASSWORD = "demo1234"
CATEGORIES = ["Лекція", "Семінар", "Майстер-клас", "Конференція"]

FIRST = ["Андрій", "Марія", "Олег", "Софія", "Тарас", "Ірина", "Богдан", "Наталя", "Назар", "Юлія", "Максим", "Вікторія"]
LAST = ["Мельник", "Шевченко", "Коваль", "Бондар", "Лисенко", "Гончар", "Ткач", "Кравець"]

# (назва, категорія, організатор, зсув днів, година, хвилина, тривалість год, місткість, місце, опис, статус, зайнято)
EVENTS = [
    ("Вступ до React Native", 2, 2, 3, 14, 0, 2, 30, "Ауд. 301, корпус 2", "Практичне заняття: створюємо перший мобільний застосунок та запускаємо його на смартфоні. Ноутбук бажано мати з собою.", "PUBLISHED", 22),
    ("Основи REST API", 0, 3, 5, 10, 0, 1.5, 25, "Ауд. 215, корпус 1", "Як проєктувати вебсервіси: ресурси, HTTP-методи, коди відповідей, автентифікація за токеном.", "PUBLISHED", 25),
    ("Студентська конференція ІТ", 3, 2, 21, 9, 0, 8, 80, "Актова зала", "Щорічна конференція: доповіді студентів, стендові презентації та панельна дискусія з представниками IT-компаній.", "PUBLISHED", 48),
    ("Семінар з тестування ПЗ", 1, 3, 9, 15, 0, 1.5, 20, "Ауд. 108, корпус 2", "Модульні та інтеграційні тести, тест-кейси, баг-репорти. Розбираємо реальні приклади з проєктів.", "PUBLISHED", 9),
    ("Git для початківців", 2, 2, 12, 16, 30, 2, 24, "Комп’ютерний клас 12", "Гілки, коміти, pull request. Працюємо в команді так, як це відбувається в індустрії.", "PUBLISHED", 11),
    ("UX-дизайн: від ідеї до прототипу", 0, 3, 16, 11, 0, 2, 60, "Ауд. 401, корпус 3", "Користувацькі сценарії, wireframe, прототип та оцінка зручності інтерфейсу.", "PUBLISHED", 37),
    ("День відкритих дверей кафедри", 3, 2, 28, 10, 0, 4, 60, "Корпус 2, фойє", "Знайомство з кафедрою, лабораторіями та студентськими проєктами для майбутніх студентів.", "PUBLISHED", 29),
    ("Хакатон «Smart Campus»", 1, 3, 35, 9, 0, 10, 40, "Коворкінг-простір", "Командний марафон: створюємо прототип сервісу для розумного кампусу за одну добу.", "PUBLISHED", 24),
    ("Вступ до Python", 0, 2, -6, 14, 0, 2, 40, "Ауд. 301, корпус 2", "Синтаксис, типи даних, функції та перші програми мовою Python.", "FINISHED", 31),
    ("Основи SQL", 1, 3, -13, 13, 0, 2, 30, "Ауд. 215, корпус 1", "Запити SELECT, об’єднання таблиць та проєктування бази даних.", "FINISHED", 26),
]


def seed_demo(db: Session) -> bool:
    """Заповнює порожню БД демонстраційними даними. Повертає True, якщо дані створено."""
    if db.scalar(select(func.count()).select_from(User)):
        return False
    rnd = random.Random(2026)
    pw = hash_password(DEMO_PASSWORD)  # один хеш для всіх демо-акаунтів (швидкий старт)

    users = [
        User(full_name="Адміністратор Системи", email="admin@edureg.test", password_hash=pw, role=Role.ADMIN),
        User(full_name="Мельник Оксана", email="melnyk@edureg.test", password_hash=pw, role=Role.ORGANIZER),
        User(full_name="Шевченко Андрій", email="shevchenko@edureg.test", password_hash=pw, role=Role.ORGANIZER),
        User(full_name="Коваль Ірина", email="koval@edureg.test", password_hash=pw, role=Role.PARTICIPANT),
    ]
    used = {"Коваль Ірина"}
    while len(users) < 52:
        name = f"{rnd.choice(LAST)} {rnd.choice(FIRST)}"
        if name in used:
            continue
        used.add(name)
        n = len(users) + 1
        users.append(User(full_name=name, email=f"user{n}@edureg.test", password_hash=pw, is_active=n % 17 != 0))
    cats = [Category(name=n) for n in CATEGORIES]
    db.add_all(users + cats)
    db.flush()

    kyiv = ZoneInfo("Europe/Kyiv")  # години заходів задано за київським часом
    now = datetime.now(timezone.utc)
    participants = [u for u in users if u.role == Role.PARTICIPANT and u.is_active]
    for title, cat, org, day, h, m, dur, cap, loc, desc, status, filled in EVENTS:
        start = (now.astimezone(kyiv) + timedelta(days=day)).replace(hour=h, minute=m, second=0, microsecond=0)
        start = start.astimezone(timezone.utc)
        ev = Event(title=title, description=desc, location=loc, start_at=start, end_at=start + timedelta(hours=dur),
                   capacity=cap, status=EventStatus(status), category_id=cats[cat].id, organizer_id=users[org - 1].id)
        db.add(ev)
        db.flush()
        pool = participants[:]
        rnd.shuffle(pool)
        must = [users[3]] if title in ("Вступ до React Native", "Семінар з тестування ПЗ", "Вступ до Python") else []
        chosen = (must + [u for u in pool if u not in must])[:min(filled, len(participants))]
        for u in chosen:
            reg = Registration(event_id=ev.id, user_id=u.id, status=RegStatus.ACTIVE, qr_token="EDU-" + secrets.token_hex(16).upper(),
                               registered_at=start - timedelta(days=2 + rnd.random() * 12))
            db.add(reg)
            db.flush()
            if status == "FINISHED" and (u.id == users[3].id or rnd.random() < 0.77):
                db.add(CheckIn(registration_id=reg.id, checked_by_id=ev.organizer_id, checked_in_at=start + timedelta(minutes=rnd.random() * 30),
                               method=CheckInMethod.QR if rnd.random() < 0.9 else CheckInMethod.MANUAL))
    db.commit()
    return True
