"""Тести реєстрацій, check-in, статистики та адміністрування."""
from datetime import datetime, timedelta, timezone

from app.models import Role
from tests.conftest import event_payload, login, make_user

E = "/api/v1/events"
R = "/api/v1/registrations"


def _participant(client, n: int):
    make_user(f"p{n}@t.test", name=f"Учасник {n}")
    return login(client, f"p{n}@t.test")


def test_register_for_event(client, user, event):
    r = client.post(f"{E}/{event['id']}/registrations", headers=user)
    assert r.status_code == 201
    b = r.json()
    assert b["status"] == "ACTIVE" and b["qrToken"].startswith("EDU-") and len(b["qrToken"]) >= 36
    assert b["event"]["registered"] == 1 and b["event"]["myRegistrationId"] == b["id"]


def test_duplicate_registration_conflict(client, user, event):
    client.post(f"{E}/{event['id']}/registrations", headers=user)
    r = client.post(f"{E}/{event['id']}/registrations", headers=user)
    assert r.status_code == 409 and "вже зареєстровані" in r.json()["message"]


def test_capacity_is_enforced(client, event):
    for i in (1, 2):
        assert client.post(f"{E}/{event['id']}/registrations", headers=_participant(client, i)).status_code == 201
    r = client.post(f"{E}/{event['id']}/registrations", headers=_participant(client, 3))
    assert r.status_code == 409 and "місць" in r.json()["message"]


def test_cancel_and_register_again_gets_new_token(client, user, event):
    first = client.post(f"{E}/{event['id']}/registrations", headers=user).json()
    c = client.delete(f"{R}/{first['id']}", headers=user)
    assert c.status_code == 200 and c.json()["status"] == "CANCELLED"
    second = client.post(f"{E}/{event['id']}/registrations", headers=user).json()
    assert second["id"] == first["id"] and second["qrToken"] != first["qrToken"] and second["status"] == "ACTIVE"


def test_cannot_cancel_foreign_registration(client, user, event):
    reg = client.post(f"{E}/{event['id']}/registrations", headers=user).json()
    assert client.delete(f"{R}/{reg['id']}", headers=_participant(client, 9)).status_code == 404


def test_registration_closed_for_past_and_cancelled_events(client, org, user):
    past = datetime.now(timezone.utc) - timedelta(days=1)
    from app.db.session import SessionLocal
    from app.models import Event
    ev = client.post(E, json=event_payload(), headers=org).json()
    with SessionLocal() as db:
        e = db.get(Event, ev["id"])
        e.start_at, e.end_at = past, past + timedelta(hours=1)
        db.commit()
    assert client.post(f"{E}/{ev['id']}/registrations", headers=user).status_code == 409
    ev2 = client.post(E, json=event_payload(), headers=org).json()
    client.delete(f"{E}/{ev2['id']}", headers=org)
    assert client.post(f"{E}/{ev2['id']}/registrations", headers=user).status_code == 409


def test_my_registrations_and_event_participants(client, org, user, event):
    client.post(f"{E}/{event['id']}/registrations", headers=user)
    mine = client.get(f"{R}/my", headers=user).json()
    assert len(mine) == 1 and mine[0]["event"]["title"] == "Тестовий захід"
    people = client.get(f"{E}/{event['id']}/registrations", headers=org).json()
    assert len(people) == 1 and people[0]["user"]["fullName"] == "Учасник Один"
    assert client.get(f"{E}/{event['id']}/registrations", headers=user).status_code == 403


def test_checkin_flow(client, org, user, event):
    reg = client.post(f"{E}/{event['id']}/registrations", headers=user).json()
    ok = client.post("/api/v1/checkin", json={"qrToken": reg["qrToken"], "eventId": event["id"]}, headers=org).json()
    assert ok["ok"] is True and ok["fullName"] == "Учасник Один"
    again = client.post("/api/v1/checkin", json={"qrToken": reg["qrToken"]}, headers=org).json()
    assert again == {**again, "ok": False, "reason": "USED"}
    bad = client.post("/api/v1/checkin", json={"qrToken": "EDU-UNKNOWN"}, headers=org).json()
    assert bad["ok"] is False and bad["reason"] == "INVALID"


def test_checkin_rules(client, org, org2, user, event):
    reg = client.post(f"{E}/{event['id']}/registrations", headers=user).json()
    assert client.post("/api/v1/checkin", json={"qrToken": reg["qrToken"]}, headers=user).status_code == 403
    assert client.post("/api/v1/checkin", json={"qrToken": reg["qrToken"]}, headers=org2).status_code == 403
    other = client.post(E, json=event_payload(title="Інший захід"), headers=org).json()
    r = client.post("/api/v1/checkin", json={"qrToken": reg["qrToken"], "eventId": other["id"]}, headers=org).json()
    assert r["ok"] is False and r["reason"] == "OTHER_EVENT"
    client.delete(f"{R}/{reg['id']}", headers=user)
    r = client.post("/api/v1/checkin", json={"qrToken": reg["qrToken"]}, headers=org).json()
    assert r["ok"] is False and r["reason"] == "CANCELLED"


def test_manual_checkin_and_cancel_after_checkin(client, org, user, event):
    reg = client.post(f"{E}/{event['id']}/registrations", headers=user).json()
    r = client.post(f"{R}/{reg['id']}/checkin", headers=org).json()
    assert r["ok"] is True
    assert client.delete(f"{R}/{reg['id']}", headers=user).status_code == 409  # присутність уже підтверджено


def test_stats_and_export(client, org, user, event):
    reg = client.post(f"{E}/{event['id']}/registrations", headers=user).json()
    client.post(f"{E}/{event['id']}/registrations", headers=_participant(client, 2))
    client.post(f"{R}/{reg['id']}/checkin", headers=org)
    s = client.get(f"{E}/{event['id']}/stats", headers=org).json()
    assert (s["capacity"], s["registered"], s["attended"], s["attendancePct"]) == (2, 2, 1, 50)
    csv = client.get(f"{E}/{event['id']}/export", headers=org)
    assert csv.status_code == 200 and csv.text.splitlines()[0] == "ПІБ,Email,Дата реєстрації,Присутній"
    assert len(csv.text.strip().splitlines()) == 3
    assert client.get(f"{E}/{event['id']}/export", headers=user).status_code == 403


def test_admin_users_management(client, admin, user):
    assert client.get("/api/v1/admin/users", headers=user).status_code == 403
    users = client.get("/api/v1/admin/users", headers=admin).json()
    uid = next(u["id"] for u in users if u["email"] == "p1@t.test")
    r = client.patch(f"/api/v1/admin/users/{uid}", json={"role": "ORGANIZER"}, headers=admin)
    assert r.status_code == 200 and r.json()["role"] == "ORGANIZER"
    client.patch(f"/api/v1/admin/users/{uid}", json={"isActive": False}, headers=admin)
    r = client.post("/api/v1/auth/login", json={"email": "p1@t.test", "password": "Secret123"})
    assert r.status_code == 403
    me = next(u["id"] for u in users if u["email"] == "admin@t.test")
    assert client.patch(f"/api/v1/admin/users/{me}", json={"role": "PARTICIPANT"}, headers=admin).status_code == 409


def test_seed_demo_data(client):
    from app.db.session import SessionLocal
    from app.models import User
    from app.seed import seed_demo
    from app.models import Category
    with SessionLocal() as db:
        db.query(Category).delete()  # фікстура вже створила категорії – очищуємо для чистого посіву
        db.commit()
        assert seed_demo(db) is True
        assert seed_demo(db) is False  # повторно не дублюється
        assert db.query(User).count() == 52
    r = client.post("/api/v1/auth/login", json={"email": "koval@edureg.test", "password": "demo1234"})
    assert r.status_code == 200
