"""Auto-discovery of links (LLDP/CDP) and of hosts seen in MAC tables."""
import re

from sqlalchemy.orm import Session

from .models import Device, Link
from .parsing import port_key, short_name


def _guess_kind(platform: str, caps: str) -> str:
    t = f"{platform} {caps}".lower()
    if "phone" in t:
        return "phone"
    if any(x in t for x in ("access point", "wlan", " ap ", "air-")):
        return "ap"
    if "router" in t and "switch" not in t:
        return "router"
    if any(x in t for x in ("switch", "bridge")):
        return "switch"
    if any(x in t for x in ("firewall", "asa", "fortigate")):
        return "firewall"
    return "other"


def find_device(db: Session, name: str, ip: str) -> Device | None:
    key = short_name(name)
    for d in db.query(Device).all():
        if short_name(d.name) == key or (ip and ip in (d.host, d.ip)):
            return d
    return None


def link_exists(db: Session, a: Device, ap: str, b: Device, bp: str) -> bool:
    ka, kb = port_key(ap), port_key(bp)
    for l in db.query(Link).filter(((Link.a_id == a.id) & (Link.b_id == b.id)) | ((Link.a_id == b.id) & (Link.b_id == a.id))):
        la, lb = (l.a_port, l.b_port) if l.a_id == a.id else (l.b_port, l.a_port)
        if (port_key(la) == ka or not la or not ka) and (port_key(lb) == kb or not lb or not kb):
            return True
    return False


def apply_neighbors(db: Session, dev: Device, neighbors: list[dict]) -> dict:
    added_links, added_devices = 0, 0
    for n in neighbors:
        remote = find_device(db, n["remote_name"], n["remote_ip"])
        if not remote:
            remote = Device(name=n["remote_name"].split("(")[0].strip()[:80], kind=_guess_kind(n["platform"], n["capabilities"]),
                            managed=False, discovered=True, ip=n["remote_ip"], notes=n["platform"][:200])
            db.add(remote)
            db.flush()
            added_devices += 1
        if remote.id == dev.id:
            continue
        if link_exists(db, dev, n["local_port"], remote, n["remote_port"]):
            continue
        db.add(Link(a_id=dev.id, b_id=remote.id, a_port=n["local_port"], b_port=n["remote_port"], source=n["protocol"]))
        db.flush()
        added_links += 1
    db.commit()
    return {"links": added_links, "devices": added_devices}


def import_hosts(db: Session, dev: Device, macs: list[dict], arps: list[dict]) -> dict:
    """Create empty machines for ports that see exactly one MAC and have no link yet."""
    def norm_mac(m):
        return re.sub(r"[^0-9a-f]", "", (m or "").lower())

    ip_by_mac = {norm_mac(r.get("mac") or r.get("mac_address") or r.get("mac_addr") or r.get("hardware_addr")):
                 (r.get("ip") or r.get("address") or r.get("ip_address") or "") for r in arps}
    per_port: dict[str, list[str]] = {}
    for r in macs:
        port = r.get("destination_port") or r.get("port") or r.get("ports") or ""
        mac = r.get("destination_address") or r.get("mac_address") or r.get("mac") or ""
        if port and mac and not re.match(r"(?i)^(cpu|router|po|port-channel|vl)", port):
            per_port.setdefault(port.strip(), []).append(mac)

    linked = {port_key(l.a_port) for l in db.query(Link).filter_by(a_id=dev.id)} | \
             {port_key(l.b_port) for l in db.query(Link).filter_by(b_id=dev.id)}
    created = 0
    for port, mlist in per_port.items():
        if len(mlist) != 1 or port_key(port) in linked:
            continue
        mac = mlist[0]
        ip = ip_by_mac.get(norm_mac(mac), "")
        host = None
        for d in db.query(Device).filter(Device.managed == False):  # noqa: E712
            if (mac and d.mac and norm_mac(d.mac) == norm_mac(mac)) or (ip and d.ip == ip):
                host = d
                break
        if not host:
            host = Device(name=(ip or mac)[:80], kind="pc", managed=False, discovered=True, ip=ip, mac=mac)
            if db.query(Device).filter_by(name=host.name).first():
                host.name = f"{host.name} ({dev.name}:{port})"[:80]
            db.add(host)
            db.flush()
        db.add(Link(a_id=dev.id, b_id=host.id, a_port=port, b_port="eth0", source="mac"))
        created += 1
    db.commit()
    return {"hosts": created}
