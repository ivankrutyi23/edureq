"""Тести автентифікації та облікових записів."""
from tests.conftest import PASSWORD, login, make_user

A = "/api/v1/auth"


def test_register_ok(client):
    r = client.post(f"{A}/register", json={"fullName": "Іван Тестовий", "email": "Ivan@Test.com", "password": "Passw0rd1"})
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["role"] == "PARTICIPANT" and body["user"]["email"] == "ivan@test.com"
    assert "passwordHash" not in str(body) and body["token"]


def test_register_weak_password(client):
    r = client.post(f"{A}/register", json={"fullName": "Іван", "email": "a@b.com", "password": "short"})
    assert r.status_code == 400 and r.json()["status"] == 400
    assert "мінімум 8" in r.json()["message"]
    r = client.post(f"{A}/register", json={"fullName": "Іван", "email": "a@b.com", "password": "onlyletters"})
    assert r.status_code == 400  # немає цифр


def test_register_bad_email(client):
    r = client.post(f"{A}/register", json={"fullName": "Іван", "email": "not-an-email", "password": "Passw0rd1"})
    assert r.status_code == 400


def test_register_duplicate_email(client):
    make_user("dup@mail.com")
    r = client.post(f"{A}/register", json={"fullName": "Хтось", "email": "DUP@mail.com", "password": "Passw0rd1"})
    assert r.status_code == 409


def test_login_ok_and_me(client):
    make_user("u@t.test")
    h = login(client, "u@t.test")
    r = client.get("/api/v1/users/me", headers=h)
    assert r.status_code == 200 and r.json()["email"] == "u@t.test"


def test_login_wrong_password_and_unknown_user_same_message(client):
    make_user("u@t.test")
    a = client.post(f"{A}/login", json={"email": "u@t.test", "password": "Wrong123"})
    b = client.post(f"{A}/login", json={"email": "nobody@t.test", "password": "Wrong123"})
    assert a.status_code == b.status_code == 401
    assert a.json()["message"] == b.json()["message"]  # не розкриваємо існування пошти


def test_account_lockout_after_failed_attempts(client):
    make_user("lock@t.test")
    for _ in range(5):
        assert client.post(f"{A}/login", json={"email": "lock@t.test", "password": "Bad12345"}).status_code == 401
    r = client.post(f"{A}/login", json={"email": "lock@t.test", "password": PASSWORD})
    assert r.status_code == 403  # навіть правильний пароль не пускає під час блокування


def test_blocked_user_cannot_login(client):
    make_user("off@t.test", active=False)
    r = client.post(f"{A}/login", json={"email": "off@t.test", "password": PASSWORD})
    assert r.status_code == 403


def test_protected_requires_token(client):
    assert client.get("/api/v1/users/me").status_code == 401
    assert client.get("/api/v1/events").status_code == 401


def test_invalid_token_rejected(client):
    r = client.get("/api/v1/users/me", headers={"Authorization": "Bearer abc.def.ghi"})
    assert r.status_code == 401


def test_health_and_unknown_route(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"
    r = client.get("/api/v1/nope")
    assert r.status_code == 404 and r.json() == {"status": 404, "message": "Ресурс не знайдено"}


def test_frontend_is_served_but_api_404_stays_json(client):
    from app.main import STATIC_DIR
    if not (STATIC_DIR / "index.html").is_file():
        return  # статичний фронтенд не зібрано – пропускаємо
    r = client.get("/")
    assert r.status_code == 200 and "<div id=\"root\">" in r.text
    assert client.get("/config.js").status_code == 200
    assert client.get("/some/spa/route").status_code == 200  # маршрут клієнта віддає index.html
    r = client.get("/api/v1/unknown")
    assert r.status_code == 404 and r.json()["status"] == 404
    assert client.get("/docs").status_code == 200
