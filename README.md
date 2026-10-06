# EduReg — реєстрація учасників освітніх заходів

Навчальний проєкт (лабораторні роботи № 6–10, дисципліна «Професійна практика програмної інженерії»):
мобільний застосунок з вебверсією та серверною частиною.

| | |
|---|---|
| **Повний застосунок (Render)** | https://edureg-app.onrender.com *(після розгортання, див. нижче)* · API-документація: `/docs` |
| **Вітрина дизайну (GitHub Pages)** | https://ivankrutyi23.github.io/edureq/ — демо в рамці смартфона, гілка `Lab6-7`, без сервера |
| **Стек** | React 18 · TypeScript · Vite · Framer Motion  /  Python 3.12 · FastAPI · SQLAlchemy · PostgreSQL · JWT |

## Розгортання на Render в один клік

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ivankrutyi23/edureq)

1. Натисніть кнопку, увійдіть у Render і підтвердіть **Apply** — [`render.yaml`](render.yaml) створить безкоштовну
   базу PostgreSQL (`edureg-db`) та **один вебсервіс `edureg-app`**, який віддає і фронтенд, і API.
2. Зачекайте 3–5 хвилин. Відкрийте адресу сервісу — запуститься повноцінний застосунок із базою даних.
3. Перевірка API: `/api/v1/health`, документація: `/docs`.

> Безкоштовний тариф: сервіс «засинає» після 15 хв бездіяльності (перший запит ~1 хв), БД діє 30 днів.

Фронтенд уже зібрано в `backend/static` (`cd frontend && npm run build:render`), тож додаткових кроків не потрібно.

## Локальний запуск

```bash
# бекенд + PostgreSQL (Docker)
cd backend
docker compose up --build          # API: http://localhost:8000, документація: http://localhost:8000/docs

# фронтенд
cd frontend
npm install
npm run dev                         # http://localhost:5173/?api=http://localhost:8000
npm run build:render                # збірка фронтенду в backend/static (її віддає FastAPI)
```

Без Docker: `pip install -r requirements-dev.txt`, `uvicorn app.main:app --reload` (за замовчуванням SQLite).
Тести: `cd backend && pytest` (36 тестів).

Демо-акаунти (пароль `demo1234`): `koval@edureg.test` — учасник, `melnyk@edureg.test` — організатор, `admin@edureg.test` — адміністратор.

## Архітектура

```
Браузер ──HTTPS──▶  FastAPI (Render): React-фронтенд + REST API /api/v1  ──SQL──▶  PostgreSQL
                    routers → services → repositories
```

```
backend/app
├── api/routers/   маршрути REST (/api/v1): auth, events, registrations, check-in, admin
├── api/deps.py    автентифікація (JWT) та авторизація за ролями
├── services/      бізнес-логіка (місткість, check-in, статистика, блокування облікових записів)
├── repositories/  запити до БД (SQLAlchemy)
├── core/          налаштування, безпека (bcrypt, JWT), єдиний формат помилок
├── models.py      ORM-моделі  ·  schemas.py  схеми валідації  ·  seed.py  демо-дані
└── main.py        застосунок FastAPI, CORS, журнал запитів
```

Безпека: паролі — bcrypt; JWT з обмеженим терміном; блокування акаунта після 5 невдалих входів; однакова відповідь
на хибну пошту й хибний пароль; перевірка ролей і прав власності на сервері; валідація всіх вхідних даних;
криптографічно стійкі QR-токени (128 біт); контроль місткості з блокуванням рядка заходу в транзакції.

Формат помилок: `{"status": 404, "message": "Захід не знайдено"}` (коди 400, 401, 403, 404, 409, 500).

## Гілки

| Гілка | Зміст |
|---|---|
| `Lab6-7` | фронтенд (демо-режим із вбудованим mock API) |
| `Lab8-10` | бекенд FastAPI + PostgreSQL, фронтенд у складі сервісу, розгортання на Render |
