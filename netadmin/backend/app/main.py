import difflib
import os
import re
import time
from datetime import datetime, timedelta

import jwt
from fastapi import Body, Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from . import config, demo, topology
from .connector import DeviceError, open_session
from .crypto import decrypt, encrypt
from .db import Base, SessionLocal, engine, get_db
from .models import Backup, ChangeLog, Device, DeviceData, Link
from .parsing import fetch_family
from .profiles import PROFILES, ConfigError, build_config, profile_list

Base.metadata.create_all(engine)
app = FastAPI(title="NetAdmin", docs_url="/api/docs", openapi_url="/api/openapi.json")

KINDS = ["router", "switch", "firewall", "ap", "server", "pc", "printer", "phone", "cloud", "other"]
FAMILIES = ["interfaces", "vlans", "neighbors", "mac", "arp", "routes", "version", "config"]


# --------------------------------------------------------------------------- auth
def _token(user: str) -> str:
    exp = datetime.utcnow() + timedelta(hours=config.TOKEN_HOURS)
    return jwt.encode({"sub": user, "exp": exp}, config.SECRET_KEY, algorithm="HS256")


def require_user(authorization: str | None = Header(None), token: str | None = Query(None)) -> str:
    raw = token or (authorization or "").removeprefix("Bearer ").strip()
    try:
        return jwt.decode(raw, config.SECRET_KEY, algorithms=["HS256"])["sub"]
    except Exception:
        raise HTTPException(401, "Non authentifié")


class Login(BaseModel):
    username: str
    password: str


_fails: dict[str, list[float]] = {}


@app.post("/api/auth/login")
def login(body: Login, request: Request):
    ip = request.client.host if request.client else "?"
    recent = [t for t in _fails.get(ip, []) if time.time() - t < 300]
    if len(recent) >= 8:
        raise HTTPException(429, "Trop de tentatives, réessaie dans quelques minutes")
    import hmac
    ok = hmac.compare_digest(body.username, config.ADMIN_USER) & hmac.compare_digest(body.password, config.ADMIN_PASSWORD)
    if not ok:
        _fails[ip] = recent + [time.time()]
        raise HTTPException(401, "Identifiants incorrects")
    _fails.pop(ip, None)
    return {"token": _token(body.username), "user": body.username,
            "default_password": config.ADMIN_PASSWORD == "changeme"}


@app.get("/api/auth/me")
def me(user: str = Depends(require_user)):
    return {"user": user}


@app.get("/api/health")
def health():
    return {"ok": True}


# --------------------------------------------------------------------------- schemas
class DeviceIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: str = "switch"
    managed: bool = True
    driver: str = "cisco_ios"
    conn_type: str = "ssh"
    host: str = ""
    ssh_port: int = 22
    username: str = ""
    password: str | None = None  # None / "" on update = keep
    secret: str | None = None
    serial_port: str = ""
    baudrate: int = 9600
    ip: str = ""
    mac: str = ""
    notes: str = ""
    pos_x: float | None = None
    pos_y: float | None = None


def dev_out(d: Device) -> dict:
    return {
        "id": d.id, "name": d.name, "kind": d.kind, "managed": d.managed, "discovered": d.discovered,
        "driver": d.driver, "conn_type": d.conn_type, "host": d.host, "ssh_port": d.ssh_port,
        "username": d.username, "has_password": bool(d.password_enc), "has_secret": bool(d.secret_enc),
        "serial_port": d.serial_port, "baudrate": d.baudrate, "ip": d.ip, "mac": d.mac, "notes": d.notes,
        "pos_x": d.pos_x, "pos_y": d.pos_y, "status": d.status,
        "last_seen": d.last_seen.isoformat() if d.last_seen else None,
    }


def link_out(l: Link) -> dict:
    return {"id": l.id, "a_id": l.a_id, "b_id": l.b_id, "a_port": l.a_port, "b_port": l.b_port,
            "label": l.label, "source": l.source}


def _apply(d: Device, body: DeviceIn, creating: bool):
    if body.kind not in KINDS:
        raise HTTPException(422, "Type d'appareil inconnu")
    if body.managed:
        if body.driver not in PROFILES:
            raise HTTPException(422, "Marque / OS inconnu")
        if body.conn_type not in ("ssh", "serial", "demo"):
            raise HTTPException(422, "Mode de connexion inconnu")
    for f in ("name", "kind", "managed", "ip", "mac", "notes", "pos_x", "pos_y"):
        setattr(d, f, getattr(body, f))
    d.name = body.name.strip()
    if body.managed:
        for f in ("driver", "conn_type", "host", "ssh_port", "username", "serial_port", "baudrate"):
            setattr(d, f, getattr(body, f))
        d.host = body.host.strip()
        if body.password:
            d.password_enc = encrypt(body.password)
        if body.secret:
            d.secret_enc = encrypt(body.secret)
    else:  # empty machine: no credentials kept
        d.host, d.username, d.password_enc, d.secret_enc, d.serial_port = "", "", "", "", ""
        d.status = "unknown"


def get_dev(db: Session, did: int) -> Device:
    d = db.get(Device, did)
    if not d:
        raise HTTPException(404, "Appareil introuvable")
    return d


# --------------------------------------------------------------------------- meta
@app.get("/api/meta", dependencies=[Depends(require_user)])
def meta():
    ports = []
    try:
        ports = sorted(f"/dev/{f}" for f in os.listdir("/dev") if re.match(r"tty(USB|ACM|S|AMA)\d+", f))
    except OSError:
        pass
    return {"profiles": profile_list(), "kinds": KINDS, "serial_ports": ports}


# --------------------------------------------------------------------------- devices
@app.get("/api/devices", dependencies=[Depends(require_user)])
def list_devices(db: Session = Depends(get_db)):
    return [dev_out(d) for d in db.query(Device).order_by(Device.name)]


@app.post("/api/devices", dependencies=[Depends(require_user)])
def create_device(body: DeviceIn, db: Session = Depends(get_db)):
    if db.query(Device).filter(Device.name == body.name.strip()).first():
        raise HTTPException(409, "Un appareil porte déjà ce nom")
    d = Device()
    _apply(d, body, True)
    db.add(d)
    db.commit()
    return dev_out(d)


@app.put("/api/devices/{did}", dependencies=[Depends(require_user)])
def update_device(did: int, body: DeviceIn, db: Session = Depends(get_db)):
    d = get_dev(db, did)
    if db.query(Device).filter(Device.name == body.name.strip(), Device.id != did).first():
        raise HTTPException(409, "Un appareil porte déjà ce nom")
    _apply(d, body, False)
    db.commit()
    return dev_out(d)


@app.delete("/api/devices/{did}", dependencies=[Depends(require_user)])
def delete_device(did: int, db: Session = Depends(get_db)):
    d = get_dev(db, did)
    db.query(Link).filter((Link.a_id == did) | (Link.b_id == did)).delete()
    db.delete(d)
    db.commit()
    return {"ok": True}


class Positions(BaseModel):
    positions: dict[int, tuple[float, float]]


@app.post("/api/devices/positions", dependencies=[Depends(require_user)])
def save_positions(body: Positions, db: Session = Depends(get_db)):
    for did, (x, y) in body.positions.items():
        d = db.get(Device, did)
        if d:
            d.pos_x, d.pos_y = x, y
    db.commit()
    return {"ok": True}


def _run(db: Session, d: Device, fn):
    """Run fn(session) on the device, updating its reachability status."""
    try:
        with open_session(d) as s:
            res = fn(s)
        d.status, d.last_seen = "up", datetime.utcnow()
        db.commit()
        return res
    except DeviceError as e:
        d.status = "down"
        db.commit()
        raise HTTPException(502, str(e))


@app.post("/api/devices/{did}/test", dependencies=[Depends(require_user)])
def test_device(did: int, db: Session = Depends(get_db)):
    d = get_dev(db, did)
    driver = d.driver
    out = _run(db, d, lambda s: s.send(PROFILES[driver]["show"]["version"][0]))
    return {"ok": True, "output": out[:600]}


@app.get("/api/devices/{did}/data/{kind}", dependencies=[Depends(require_user)])
def device_data(did: int, kind: str, refresh: bool = False, db: Session = Depends(get_db)):
    if kind not in FAMILIES:
        raise HTTPException(404, "Type de données inconnu")
    d = get_dev(db, did)
    cached = db.query(DeviceData).filter_by(device_id=did, kind=kind).first()
    if cached and not refresh:
        return {**cached.payload, "fetched_at": cached.fetched_at.isoformat(), "cached": True}
    try:
        payload = _run(db, d, lambda s: fetch_family(s, d.driver, kind))
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    if cached:
        cached.payload, cached.fetched_at = payload, datetime.utcnow()
    else:
        cached = DeviceData(device_id=did, kind=kind, payload=payload)
        db.add(cached)
    db.commit()
    return {**payload, "fetched_at": cached.fetched_at.isoformat(), "cached": False}


class Cli(BaseModel):
    commands: list[str] = Field(min_length=1, max_length=50)


@app.post("/api/devices/{did}/cli", dependencies=[Depends(require_user)])
def run_cli(did: int, body: Cli, db: Session = Depends(get_db)):
    d = get_dev(db, did)

    def go(s):
        res = []
        for c in body.commands:
            try:
                res.append({"command": c, "output": s.send(c)})
            except DeviceError as e:
                res.append({"command": c, "output": str(e), "error": True})
            except RuntimeError as e:
                res.append({"command": c, "output": str(e), "error": True})
        return res

    return {"results": _run(db, d, go)}


# --------------------------------------------------------------------------- config
class ConfigReq(BaseModel):
    action: str
    params: dict = {}


class ApplyReq(BaseModel):
    commands: list[str] = Field(min_length=1, max_length=200)
    save: bool = False


@app.post("/api/devices/{did}/config/preview", dependencies=[Depends(require_user)])
def config_preview(did: int, body: ConfigReq, db: Session = Depends(get_db)):
    d = get_dev(db, did)
    try:
        return {"commands": build_config(d.driver, body.action, body.params)}
    except ConfigError as e:
        raise HTTPException(422, str(e))


@app.post("/api/devices/{did}/config/apply", dependencies=[Depends(require_user)])
def config_apply(did: int, body: ApplyReq, db: Session = Depends(get_db)):
    d = get_dev(db, did)
    try:
        def go(s):
            out = s.send_config(body.commands)
            if body.save:
                out += "\n" + s.save()
            return out
        out = _run(db, d, go)
        ok = True
    except HTTPException as e:
        db.add(ChangeLog(device_id=did, device_name=d.name, commands="\n".join(body.commands),
                          output=str(e.detail), ok=False))
        db.commit()
        raise
    db.add(ChangeLog(device_id=did, device_name=d.name, commands="\n".join(body.commands), output=out, ok=ok))
    db.query(DeviceData).filter(DeviceData.device_id == did, DeviceData.kind != "config").delete()  # stale now
    db.commit()
    return {"ok": True, "output": out, "warning": bool(re.search(r"(?i)invalid|error|% ", out))}


@app.get("/api/changelog", dependencies=[Depends(require_user)])
def changelog(device_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(ChangeLog).order_by(ChangeLog.id.desc())
    if device_id:
        q = q.filter(ChangeLog.device_id == device_id)
    return [{"id": c.id, "device": c.device_name, "commands": c.commands, "output": c.output, "ok": c.ok,
             "at": c.created_at.isoformat()} for c in q.limit(100)]


# --------------------------------------------------------------------------- backups
@app.get("/api/devices/{did}/backups", dependencies=[Depends(require_user)])
def list_backups(did: int, db: Session = Depends(get_db)):
    get_dev(db, did)
    return [{"id": b.id, "at": b.created_at.isoformat(), "size": len(b.content)}
            for b in db.query(Backup).filter_by(device_id=did).order_by(Backup.id.desc())]


@app.post("/api/devices/{did}/backups", dependencies=[Depends(require_user)])
def make_backup(did: int, db: Session = Depends(get_db)):
    d = get_dev(db, did)
    cmd = PROFILES[d.driver]["show"]["config"]
    if not cmd:
        raise HTTPException(422, "Sauvegarde non gérée pour cette marque")
    out = _run(db, d, lambda s: s.send(cmd[0]))
    b = Backup(device_id=did, content=out)
    db.add(b)
    db.commit()
    return {"id": b.id, "at": b.created_at.isoformat(), "size": len(out)}


@app.get("/api/backups/{bid}", dependencies=[Depends(require_user)])
def get_backup(bid: int, against: int | None = None, db: Session = Depends(get_db)):
    b = db.get(Backup, bid)
    if not b:
        raise HTTPException(404, "Sauvegarde introuvable")
    res = {"id": b.id, "at": b.created_at.isoformat(), "content": b.content}
    if against:
        o = db.get(Backup, against)
        if o:
            res["diff"] = "\n".join(difflib.unified_diff(o.content.splitlines(), b.content.splitlines(),
                                                         f"#{o.id}", f"#{b.id}", lineterm="", n=2))
    return res


@app.delete("/api/backups/{bid}", dependencies=[Depends(require_user)])
def delete_backup(bid: int, db: Session = Depends(get_db)):
    b = db.get(Backup, bid)
    if b:
        db.delete(b)
        db.commit()
    return {"ok": True}


# --------------------------------------------------------------------------- links / topology
class LinkIn(BaseModel):
    a_id: int
    b_id: int
    a_port: str = ""
    b_port: str = ""
    label: str = ""


@app.get("/api/topology", dependencies=[Depends(require_user)])
def topology_get(db: Session = Depends(get_db)):
    return {"devices": [dev_out(d) for d in db.query(Device)], "links": [link_out(l) for l in db.query(Link)]}


@app.post("/api/links", dependencies=[Depends(require_user)])
def create_link(body: LinkIn, db: Session = Depends(get_db)):
    if body.a_id == body.b_id:
        raise HTTPException(422, "Un lien relie deux appareils différents")
    get_dev(db, body.a_id), get_dev(db, body.b_id)
    l = Link(**body.model_dump(), source="manual")
    db.add(l)
    db.commit()
    return link_out(l)


@app.put("/api/links/{lid}", dependencies=[Depends(require_user)])
def update_link(lid: int, body: LinkIn, db: Session = Depends(get_db)):
    l = db.get(Link, lid)
    if not l:
        raise HTTPException(404, "Lien introuvable")
    for k, v in body.model_dump().items():
        setattr(l, k, v)
    db.commit()
    return link_out(l)


@app.delete("/api/links/{lid}", dependencies=[Depends(require_user)])
def delete_link(lid: int, db: Session = Depends(get_db)):
    l = db.get(Link, lid)
    if l:
        db.delete(l)
        db.commit()
    return {"ok": True}


class DiscoverReq(BaseModel):
    device_ids: list[int] | None = None
    import_hosts: bool = False


@app.post("/api/topology/discover", dependencies=[Depends(require_user)])
def discover(body: DiscoverReq, db: Session = Depends(get_db)):
    q = db.query(Device).filter(Device.managed == True)  # noqa: E712
    if body.device_ids:
        q = q.filter(Device.id.in_(body.device_ids))
    report, totals = [], {"links": 0, "devices": 0, "hosts": 0}
    for d in q.all():
        entry = {"device": d.name, "ok": True, "links": 0, "devices": 0, "hosts": 0}
        try:
            nb = _run(db, d, lambda s: fetch_family(s, d.driver, "neighbors"))
            r = topology.apply_neighbors(db, d, nb["rows"])
            entry.update(r)
            if body.import_hosts:
                macs = _run(db, d, lambda s: fetch_family(s, d.driver, "mac"))
                arps = _run(db, d, lambda s: fetch_family(s, d.driver, "arp"))
                entry["hosts"] = topology.import_hosts(db, d, macs["rows"], arps["rows"])["hosts"]
        except HTTPException as e:
            entry.update(ok=False, error=str(e.detail))
        except RuntimeError as e:
            entry.update(ok=False, error=str(e))
        for k in totals:
            totals[k] += entry.get(k, 0)
        report.append(entry)
    return {"report": report, **totals}


@app.post("/api/demo/seed", dependencies=[Depends(require_user)])
def demo_seed(db: Session = Depends(get_db)):
    return {"created": demo.seed(db)}


# --------------------------------------------------------------------------- export / import
@app.get("/api/export", dependencies=[Depends(require_user)])
def export_all(db: Session = Depends(get_db)):
    devs = [dev_out(d) for d in db.query(Device)]
    for d in devs:
        d.pop("has_password"), d.pop("has_secret"), d.pop("status"), d.pop("last_seen")
    return {"version": 1, "devices": devs, "links": [link_out(l) for l in db.query(Link)]}


@app.post("/api/import", dependencies=[Depends(require_user)])
def import_all(data: dict = Body(...), db: Session = Depends(get_db)):
    idmap, n = {}, 0
    for d in data.get("devices", []):
        ex = db.query(Device).filter_by(name=d["name"]).first()
        if not ex:
            ex = Device(name=d["name"])
            db.add(ex)
            n += 1
        for f in ("kind", "managed", "discovered", "driver", "conn_type", "host", "ssh_port", "username",
                  "serial_port", "baudrate", "ip", "mac", "notes", "pos_x", "pos_y"):
            if f in d:
                setattr(ex, f, d[f])
        db.flush()
        idmap[d["id"]] = ex.id
    for l in data.get("links", []):
        a, b = idmap.get(l["a_id"]), idmap.get(l["b_id"])
        if a and b and not topology.link_exists(db, db.get(Device, a), l["a_port"], db.get(Device, b), l["b_port"]):
            db.add(Link(a_id=a, b_id=b, a_port=l["a_port"], b_port=l["b_port"], label=l.get("label", ""),
                        source=l.get("source", "manual")))
    db.commit()
    return {"devices_created": n}


# --------------------------------------------------------------------------- SPA
if config.STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=config.STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        f = (config.STATIC_DIR / path).resolve()
        if path and f.is_file() and config.STATIC_DIR.resolve() in f.parents:
            return FileResponse(f)
        return FileResponse(config.STATIC_DIR / "index.html")
