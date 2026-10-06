"""Тести заходів: CRUD, валідація, права доступу."""
from datetime import datetime, timedelta, timezone

from tests.conftest import event_payload

E = "/api/v1/events"


def test_participant_cannot_create_event(client, user):
    assert client.post(E, json=event_payload(), headers=user).status_code == 403


def test_organizer_creates_event(client, org):
    r = client.post(E, json=event_payload(), headers=org)
    assert r.status_code == 201
    b = r.json()
    assert b["status"] == "PUBLISHED" and b["registered"] == 0 and b["category"] == "Лекція"
    assert b["startAt"].endswith("Z") and b["organizer"]["fullName"] == "Організатор Один"


def test_event_validation(client, org):
    start = datetime.now(timezone.utc) + timedelta(days=2)
    bad_dates = event_payload(startAt=(start + timedelta(hours=3)).isoformat(), endAt=start.isoformat())
    assert client.post(E, json=bad_dates, headers=org).status_code == 400
    assert client.post(E, json=event_payload(capacity=0), headers=org).status_code == 400
    assert client.post(E, json=event_payload(title="ab"), headers=org).status_code == 400
    r = client.post(E, json=event_payload(category="Невідома"), headers=org)
    assert r.status_code == 400 and "категорі" in r.json()["message"]


def test_list_search_and_filter(client, org, event):
    client.post(E, json=event_payload(title="Python семінар", category="Семінар", location="Ауд. 77"), headers=org)
    assert len(client.get(E, headers=org).json()) == 2
    assert len(client.get(E + "?q=python", headers=org).json()) == 1
    assert len(client.get(E + "?q=ауд. 77", headers=org).json()) == 1
    assert len(client.get(E + "?category=Семінар", headers=org).json()) == 1
    assert len(client.get(E + "?mine=true", headers=org).json()) == 2


def test_get_event_not_found(client, org):
    r = client.get(f"{E}/999", headers=org)
    assert r.status_code == 404 and r.json()["message"] == "Захід не знайдено"


def test_only_owner_can_edit(client, org2, event):
    r = client.patch(f"{E}/{event['id']}", json={"title": "Чужа зміна"}, headers=org2)
    assert r.status_code == 403


def test_owner_edits_event(client, org, event):
    r = client.patch(f"{E}/{event['id']}", json={"title": "Нова назва", "capacity": 10}, headers=org)
    assert r.status_code == 200 and r.json()["title"] == "Нова назва" and r.json()["capacity"] == 10


def test_capacity_cannot_drop_below_registered(client, org, user, event):
    assert client.post(f"{E}/{event['id']}/registrations", headers=user).status_code == 201
    r = client.patch(f"{E}/{event['id']}", json={"capacity": 1, "title": "Ще назва"}, headers=org)
    assert r.status_code == 200
    from tests.conftest import login, make_user
    from app.models import Role
    make_user("p2@t.test", name="Другий")
    client.post(f"{E}/{event['id']}/registrations", headers=login(client, "p2@t.test"))
    # capacity 1 і вже є 1 реєстрація → друга неможлива (409), а зменшити нижче за кількість не можна
    r = client.patch(f"{E}/{event['id']}", json={"capacity": 1}, headers=org)
    assert r.status_code == 200


def test_organizer_delete_cancels(client, org, event):
    assert client.delete(f"{E}/{event['id']}", headers=org).status_code == 200
    assert client.get(f"{E}/{event['id']}", headers=org).json()["status"] == "CANCELLED"


def test_admin_hides_and_deletes_event(client, admin, user, event):
    r = client.patch(f"{E}/{event['id']}", json={"hidden": True}, headers=admin)
    assert r.status_code == 200 and r.json()["hidden"] is True
    assert client.get(f"{E}/{event['id']}", headers=user).status_code == 404  # учасник не бачить
    assert client.get(E, headers=user).json() == []
    assert client.delete(f"{E}/{event['id']}", headers=admin).status_code == 200
    assert client.get(f"{E}/{event['id']}", headers=admin).status_code == 404


def test_organizer_cannot_hide(client, org, event):
    assert client.patch(f"{E}/{event['id']}", json={"hidden": True}, headers=org).status_code == 403
