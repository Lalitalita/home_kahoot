import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()
os.environ["ADMIN_PASSWORD"] = "pw"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.profiles import ConfigError, build_config  # noqa: E402
import pytest  # noqa: E402

c = TestClient(app)


def auth():
    r = c.post("/api/auth/login", json={"username": "admin", "password": "pw"})
    assert r.status_code == 200
    return {"Authorization": "Bearer " + r.json()["token"]}


def test_auth_required():
    assert c.get("/api/devices").status_code == 401
    assert c.post("/api/auth/login", json={"username": "admin", "password": "x"}).status_code == 401


def test_crud_and_empty_machine():
    h = auth()
    r = c.post("/api/devices", json={"name": "PC-Bob", "kind": "pc", "managed": False, "ip": "10.0.0.5"}, headers=h)
    assert r.status_code == 200 and r.json()["managed"] is False
    did = r.json()["id"]
    assert c.post("/api/devices", json={"name": "PC-Bob", "kind": "pc", "managed": False}, headers=h).status_code == 409
    r = c.put(f"/api/devices/{did}", json={"name": "PC-Bob2", "kind": "pc", "managed": False}, headers=h)
    assert r.json()["name"] == "PC-Bob2"
    assert c.get(f"/api/devices/{did}/data/vlans", headers=h).status_code == 502  # nothing behind it
    assert c.delete(f"/api/devices/{did}", headers=h).status_code == 200


def test_password_never_returned():
    h = auth()
    r = c.post("/api/devices", json={"name": "sw-x", "host": "1.2.3.4", "username": "u", "password": "secret!"}, headers=h)
    assert "secret!" not in r.text and r.json()["has_password"] is True
    assert c.post(f"/api/devices/{r.json()['id']}/test", headers=h).status_code == 502  # unreachable


def test_demo_and_discovery():
    h = auth()
    assert c.post("/api/demo/seed", headers=h).json()["created"] >= 5
    topo = c.get("/api/topology", headers=h).json()
    n_links = len(topo["links"])
    assert n_links == 10
    dev = {d["name"]: d for d in topo["devices"]}
    for kind in ("interfaces", "vlans", "neighbors", "mac", "arp", "routes", "version", "config"):
        r = c.get(f"/api/devices/{dev['SW-Etage1']['id']}/data/{kind}?refresh=1", headers=h)
        assert r.status_code == 200, (kind, r.text)
        assert r.json()["rows"] or r.json()["raw"], kind
    nb = c.get(f"/api/devices/{dev['SW-Core']['id']}/data/neighbors", headers=h).json()["rows"]
    assert {n["remote_name"] for n in nb} == {"SW-Etage1", "SW-Etage2", "R-Core"}
    iface = c.get(f"/api/devices/{dev['SW-Etage1']['id']}/data/interfaces", headers=h).json()
    assert iface["rows"][0]["port"] == "Gi1/0/1"
    # discovery is idempotent: existing links are recognised
    r = c.post("/api/topology/discover", json={"import_hosts": True}, headers=h).json()
    assert r["links"] == 0 and r["devices"] == 0 and r["hosts"] == 0, r
    assert len(c.get("/api/topology", headers=h).json()["links"]) == n_links


def test_config_preview_apply():
    h = auth()
    dev = {d["name"]: d for d in c.get("/api/topology", headers=h).json()["devices"]}
    did = dev["SW-Etage1"]["id"]
    r = c.post(f"/api/devices/{did}/config/preview", json={"action": "interface", "params": {
        "name": "Gi1/0/4", "description": "PC Bob", "admin": "up", "mode": "access", "vlan": 10}}, headers=h)
    assert r.json()["commands"] == ["interface Gi1/0/4", "description PC Bob", "switchport mode access",
                                    "switchport access vlan 10", "no shutdown"]
    bad = c.post(f"/api/devices/{did}/config/preview", json={"action": "vlan_add", "params": {"id": 5000}}, headers=h)
    assert bad.status_code == 422
    r = c.post(f"/api/devices/{did}/config/apply", json={"commands": r.json()["commands"], "save": True}, headers=h)
    assert r.status_code == 200
    assert c.get("/api/changelog", headers=h).json()[0]["ok"] is True


def test_backups_and_diff():
    h = auth()
    did = {d["name"]: d for d in c.get("/api/topology", headers=h).json()["devices"]}["SW-Etage1"]["id"]
    b1 = c.post(f"/api/devices/{did}/backups", headers=h).json()
    b2 = c.post(f"/api/devices/{did}/backups", headers=h).json()
    assert c.get(f"/api/backups/{b2['id']}?against={b1['id']}", headers=h).json()["diff"] == ""


def test_builders():
    assert build_config("hp_procurve", "interface", {"name": "5", "mode": "access", "vlan": 20}) == \
        ["vlan 20", "untagged 5", "exit"]
    assert build_config("juniper_junos", "route_add", {"network": "10.1.0.0/16", "nexthop": "10.0.0.1"}) == \
        ["set routing-options static route 10.1.0.0/16 next-hop 10.0.0.1"]
    assert build_config("cisco_ios", "route_add", {"network": "10.1.0.0", "mask": "255.255.0.0", "nexthop": "10.0.0.1"}) == \
        ["ip route 10.1.0.0 255.255.0.0 10.0.0.1"]
    with pytest.raises(ConfigError):
        build_config("cisco_ios", "hostname", {"name": "bad\nreload"})
    with pytest.raises(ConfigError):
        build_config("cisco_ios", "interface", {"name": "Gi1/0/1", "description": "x\nreload"})
