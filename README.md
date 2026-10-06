# EduReg — реєстрація учасників освітніх заходів

Навчальний проєкт (лабораторні роботи № 6–10, дисципліна «Професійна практика програмної інженерії»):
мобільний застосунок з вебверсією та серверною частиною.

| | |
|---|---|
| **Демо (фронтенд)** | https://ivankrutyi23.github.io/edureq/ |
| **API (Render)** | https://edureg-api.onrender.com/docs *(після розгортання, див. нижче)* |
| **Стек** | React 18 · TypeScript · Vite · Framer Motion  /  Python 3.12 · FastAPI · SQLAlchemy · PostgreSQL · JWT |

## Розгортання в один клік

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ivankrutyi23/edureq)

1. Натисніть кнопку, увійдіть у Render і підтвердіть **Apply** — файл [`render.yaml`](render.yaml) створить
   безкоштовну базу PostgreSQL (`edureg-db`) та вебсервіс `edureg-api` (FastAPI).
2. Зачекайте 3–5 хвилин, поки завершиться збирання. Перевірка: `https://edureg-api.onrender.com/api/v1/health`.
3. Усе. Сайт на GitHub Pages **сам підключається до сервера** (адреса задана в `docs/config.js`),
   а якщо сервер недоступний — працює в демо-режимі. Якщо Render видав іншу адресу (ім’я сервісу зайняте) —
   вставте її в поле «Джерело даних» на демо-сторінці або змініть `apiUrl` у `docs/config.js`.

> Безкоштовний тариф Render: сервіс «засинає» після 15 хвилин бездіяльності (перший запит ~ 1 хв — застосунок
> показує повідомлення про це), безкоштовна БД діє 30 днів. Для оцінювання роботи цього достатньо.

## Локальний запуск

```bash
# бекенд + PostgreSQL (Docker)
cd backend
docker compose up --build          # API: http://localhost:8000, документація: http://localhost:8000/docs

# фронтенд
cd frontend
npm install
npm run dev                         # http://localhost:5173/?api=http://localhost:8000
```

Без Docker: `pip install -r requirements-dev.txt`, `uvicorn app.main:app --reload` (за замовчуванням SQLite).
Тести: `cd backend && pytest` (35 тестів).

Демо-акаунти (пароль `demo1234`): `koval@edureg.test` — учасник, `melnyk@edureg.test` — організатор, `admin@edureg.test` — адміністратор.

## Архітектура

```
React (GitHub Pages)  ──HTTPS/JSON, JWT──▶  FastAPI (Render)  ──SQL──▶  PostgreSQL
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
| `Lab8-10` | бекенд FastAPI + PostgreSQL, підключення фронтенду, розгортання на Render |
