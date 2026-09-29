"""Turn raw CLI output into rows (via ntc-templates) and normalise neighbours."""
import re

from .profiles import PROFILES, looks_like_error


def parse(driver: str, cmd: str, raw: str) -> list[dict]:
    try:
        from ntc_templates.parse import parse_output

        rows = parse_output(platform=PROFILES[driver]["ntc"], command=cmd, data=raw)
    except Exception:
        return []
    return [{k: (", ".join(v) if isinstance(v, list) else v) for k, v in r.items()} for r in rows]


def _get(row: dict, *keys) -> str:
    for k in keys:
        v = row.get(k)
        if v:
            return str(v).strip()
    return ""


def normalize_neighbors(rows: list[dict], proto: str) -> list[dict]:
    out = []
    for r in rows:
        name = _get(r, "destination_host", "neighbor_name", "neighbor", "sys_name", "system_name", "chassis_id")
        out.append({
            "local_port": _get(r, "local_interface", "local_port", "local_intf", "interface"),
            "remote_name": name,
            "remote_port": _get(r, "neighbor_interface", "remote_port", "neighbor_port_id", "port_id", "port"),
            "remote_ip": _get(r, "mgmt_address", "management_ip", "mgmt_ip", "ip_address"),
            "platform": _get(r, "platform", "neighbor_description", "system_description"),
            "capabilities": _get(r, "capabilities"),
            "protocol": proto,
        })
    return [n for n in out if n["remote_name"] and n["local_port"]]


_ABBR = [("tengigabitethernet", "te"), ("gigabitethernet", "gi"), ("fastethernet", "fa"),
         ("ethernet", "eth"), ("port-channel", "po"), ("management", "mgmt")]


def port_key(p: str) -> str:
    p = re.sub(r"\s+", "", (p or "").lower())
    for long, short in _ABBR:
        if p.startswith(long):
            return short + p[len(long):]
    return p


def short_name(name: str) -> str:
    """'SW1.lab.local(SN123)' -> 'sw1'"""
    name = re.sub(r"\(.*?\)", "", name or "").strip().lower()
    return name.split(".")[0] if not re.match(r"^\d+\.\d+\.\d+\.\d+$", name) else name


def fetch_family(sess, driver: str, kind: str) -> dict:
    """Run the commands of one family. 'neighbors' aggregates all commands, others use the first that works."""
    prof = PROFILES[driver]
    cmds = prof["show"].get(kind) or []
    if not cmds:
        return {"kind": kind, "supported": False, "rows": [], "raw": "", "command": ""}
    result = {"kind": kind, "supported": True, "rows": [], "raw": "", "command": "", "errors": []}
    raws = []
    for cmd in cmds:
        try:
            raw = sess.send(cmd)
        except Exception as e:
            result["errors"].append(str(e))
            continue
        if looks_like_error(raw):
            result["errors"].append(f"'{cmd}' non supportée")
            continue
        rows = parse(driver, cmd, raw)
        if kind == "neighbors":
            proto = "cdp" if "cdp" in cmd else "lldp"
            result["rows"] += normalize_neighbors(rows, proto)
            raws.append(f"$ {cmd}\n{raw}")
            result["command"] = ", ".join(x for x in (result["command"], cmd) if x)
            continue
        raws.append(raw)
        result["command"] = cmd
        if rows or kind in ("config", "version"):
            result["rows"] = rows
            result["raw"] = raw
            return result
    if raws:
        result["raw"] = "\n\n".join(raws)
    if not result["rows"] and not raws and result["errors"]:
        raise RuntimeError("; ".join(result["errors"]))
    return result
