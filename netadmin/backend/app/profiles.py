"""Vendor profiles: which commands to run, and how to build config commands."""
import ipaddress
import re

# Commands tried in order ("first" -> first one that works) or all of them ("all").
CISCO_LIKE_SHOW = {
    "version": ["show version"],
    "interfaces": ["show interfaces status", "show ip interface brief"],
    "vlans": ["show vlan brief", "show vlan"],
    "neighbors": ["show lldp neighbors detail", "show cdp neighbors detail"],
    "mac": ["show mac address-table", "show mac-address-table"],
    "arp": ["show ip arp"],
    "routes": ["show ip route"],
    "config": ["show running-config"],
}

PROFILES = {
    "cisco_ios": dict(
        label="Cisco IOS / IOS-XE", vendor="Cisco", netmiko="cisco_ios", ntc="cisco_ios",
        show=CISCO_LIKE_SHOW, paging="terminal length 0", cfg_enter="configure terminal",
        cfg_exit="end", save="write memory", family="cisco",
    ),
    "cisco_nxos": dict(
        label="Cisco NX-OS", vendor="Cisco", netmiko="cisco_nxos", ntc="cisco_nxos",
        show={**CISCO_LIKE_SHOW, "interfaces": ["show interface status", "show ip interface brief"],
              "mac": ["show mac address-table"]},
        paging="terminal length 0", cfg_enter="configure terminal", cfg_exit="end",
        save="copy running-config startup-config", family="nxos",
    ),
    "arista_eos": dict(
        label="Arista EOS", vendor="Arista", netmiko="arista_eos", ntc="arista_eos",
        show={**CISCO_LIKE_SHOW, "mac": ["show mac address-table"]},
        paging="terminal length 0", cfg_enter="configure", cfg_exit="end", save="write",
        family="arista",
    ),
    "hp_procurve": dict(
        label="HP / Aruba ProCurve (OS-Switch)", vendor="HP", netmiko="hp_procurve", ntc="hp_procurve",
        show={
            "version": ["show version"],
            "interfaces": ["show interfaces brief"],
            "vlans": ["show vlans"],
            "neighbors": ["show lldp info remote-device", "show cdp neighbors detail"],
            "mac": ["show mac-address"],
            "arp": ["show arp"],
            "routes": ["show ip route"],
            "config": ["show running-config"],
        },
        paging="no page", cfg_enter="configure", cfg_exit="end", save="write memory", family="procurve",
    ),
    "aruba_aoscx": dict(
        label="Aruba AOS-CX", vendor="HP", netmiko="aruba_aoscx", ntc="aruba_aoscx",
        show={
            "version": ["show version"],
            "interfaces": ["show interface brief"],
            "vlans": ["show vlan"],
            "neighbors": ["show lldp neighbor-info detail"],
            "mac": ["show mac-address-table"],
            "arp": ["show arp all-vrfs"],
            "routes": ["show ip route all-vrfs"],
            "config": ["show running-config"],
        },
        paging="no page", cfg_enter="configure terminal", cfg_exit="end", save="write memory",
        family="cisco",
    ),
    "hp_comware": dict(
        label="HP / H3C Comware", vendor="HP", netmiko="hp_comware", ntc="hp_comware",
        show={
            "version": ["display version"],
            "interfaces": ["display interface brief"],
            "vlans": ["display vlan brief"],
            "neighbors": ["display lldp neighbor-information list"],
            "mac": ["display mac-address"],
            "arp": ["display arp"],
            "routes": ["display ip routing-table"],
            "config": ["display current-configuration"],
        },
        paging="screen-length disable", cfg_enter="system-view", cfg_exit="return", save="save force",
        family="comware",
    ),
    "juniper_junos": dict(
        label="Juniper Junos", vendor="Juniper", netmiko="juniper_junos", ntc="juniper_junos",
        show={
            "version": ["show version"],
            "interfaces": ["show interfaces terse"],
            "vlans": ["show vlans"],
            "neighbors": ["show lldp neighbors"],
            "mac": ["show ethernet-switching table"],
            "arp": ["show arp no-resolve"],
            "routes": ["show route"],
            "config": ["show configuration | display set"],
        },
        paging="set cli screen-length 0", cfg_enter="configure", cfg_exit="commit and-quit", save="",
        family="junos",
    ),
    "mikrotik_routeros": dict(
        label="MikroTik RouterOS", vendor="MikroTik", netmiko="mikrotik_routeros", ntc="mikrotik_routeros",
        show={
            "version": ["/system resource print"],
            "interfaces": ["/interface print terse"],
            "vlans": ["/interface vlan print terse"],
            "neighbors": ["/ip neighbor print terse"],
            "mac": ["/interface bridge host print terse"],
            "arp": ["/ip arp print terse"],
            "routes": ["/ip route print terse"],
            "config": ["/export"],
        },
        paging="", cfg_enter="", cfg_exit="", save="", family="mikrotik",
    ),
    "fortinet": dict(
        label="Fortinet FortiOS", vendor="Fortinet", netmiko="fortinet", ntc="fortinet",
        show={
            "version": ["get system status"],
            "interfaces": ["get system interface physical"],
            "vlans": [],
            "neighbors": [],
            "mac": [],
            "arp": ["get system arp"],
            "routes": ["get router info routing-table all"],
            "config": ["show full-configuration"],
        },
        paging="", cfg_enter="", cfg_exit="", save="", family="fortinet",
    ),
    "generic": dict(
        label="Autre (SSH générique / Linux)", vendor="Autre", netmiko="linux", ntc="linux",
        show={
            "version": ["uname -a"], "interfaces": ["ip -br addr"], "vlans": [], "neighbors": ["ip neigh"],
            "mac": [], "arp": ["ip neigh"], "routes": ["ip route"], "config": [],
        },
        paging="", cfg_enter="", cfg_exit="", save="", family="generic",
    ),
}

# Output that means "command not supported here"
ERROR_MARKERS = (
    "invalid input", "% invalid", "unknown command", "unrecognized command", "syntax error",
    "bad command", "incomplete command", "ambiguous command", "invalid command", "unknown parameter",
    "not found", "no such command", "invalid syntax",
)


def looks_like_error(out: str) -> bool:
    head = out.strip().lower()[:300]
    return any(m in head for m in ERROR_MARKERS)


def profile_list():
    return [{"id": k, "label": v["label"], "vendor": v["vendor"], "family": v["family"]}
            for k, v in PROFILES.items()]


# ---------------------------------------------------------------------------
# Config command builders
# ---------------------------------------------------------------------------
_SAFE = re.compile(r"^[^\r\n\x00]*$")
_IFACE = re.compile(r"^[A-Za-z0-9/.:_\- ]{1,60}$")


class ConfigError(ValueError):
    pass


def _s(v, field, pattern=None, required=False):
    v = "" if v is None else str(v).strip()
    if required and not v:
        raise ConfigError(f"Champ requis : {field}")
    if not _SAFE.match(v) or (v and pattern and not pattern.match(v)):
        raise ConfigError(f"Valeur invalide pour {field}")
    return v


def _vlan(v, field="vlan"):
    try:
        n = int(v)
    except (TypeError, ValueError):
        raise ConfigError(f"VLAN invalide : {v}")
    if not 1 <= n <= 4094:
        raise ConfigError(f"VLAN hors plage : {n}")
    return n


def _vlan_list(v):
    v = _s(v, "vlans", re.compile(r"^[0-9,\-]+$"))
    return v


def _net(network, mask):
    """Accepts '10.0.0.0' + '255.255.255.0' | '/24' | '10.0.0.0/24' -> IPv4Network."""
    network, mask = _s(network, "réseau", required=True), _s(mask, "masque")
    try:
        if "/" in network:
            return ipaddress.ip_network(network, strict=False)
        if mask.startswith("/") or mask.isdigit():
            return ipaddress.ip_network(f"{network}/{mask.lstrip('/')}", strict=False)
        return ipaddress.ip_network(f"{network}/{mask}", strict=False)
    except ValueError as e:
        raise ConfigError(f"Réseau invalide : {e}")


def _ip(v, field):
    v = _s(v, field, required=True)
    try:
        return str(ipaddress.ip_address(v))
    except ValueError:
        raise ConfigError(f"Adresse IP invalide : {v}")


def build_config(driver: str, action: str, p: dict) -> list[str]:
    fam = PROFILES[driver]["family"]
    out: list[str] = []

    if action == "raw":
        lines = [l for l in (p.get("commands") or []) if str(l).strip()]
        if not lines:
            raise ConfigError("Aucune commande")
        return [str(l) for l in lines]

    if action == "hostname":
        n = _s(p.get("name"), "nom", re.compile(r"^[A-Za-z0-9_.\-]{1,63}$"), True)
        return {"comware": [f"sysname {n}"], "junos": [f"set system host-name {n}"],
                "mikrotik": [f"/system identity set name={n}"],
                "fortinet": ["config system global", f"set hostname {n}", "end"]}.get(fam, [f"hostname {n}"])

    if action == "vlan_add":
        vid, name = _vlan(p.get("id")), _s(p.get("name"), "nom", re.compile(r"^[A-Za-z0-9_.\-]{1,32}$"))
        if fam in ("cisco", "nxos", "arista", "procurve", "comware"):
            out = [f"vlan {vid}"] + ([f"name {name}"] if name else [])
            if fam == "comware":
                out = [f"vlan {vid}"] + ([f"name {name}"] if name else [])
            return out
        if fam == "junos":
            return [f"set vlans {name or 'VLAN' + str(vid)} vlan-id {vid}"]
        raise ConfigError("Création de VLAN non gérée pour cette marque (utilise la console CLI)")

    if action == "vlan_del":
        vid = _vlan(p.get("id"))
        if fam in ("cisco", "nxos", "arista", "procurve"):
            return [f"no vlan {vid}"]
        if fam == "comware":
            return [f"undo vlan {vid}"]
        if fam == "junos":
            raise ConfigError("Suppression de VLAN Junos : utilise la console CLI (nom requis)")
        raise ConfigError("Suppression de VLAN non gérée pour cette marque")

    if action in ("route_add", "route_del"):
        net = _net(p.get("network"), p.get("mask"))
        nh = _ip(p.get("nexthop"), "passerelle")
        add = action == "route_add"
        if fam == "cisco":
            c = f"ip route {net.network_address} {net.netmask} {nh}"
            return [c if add else f"no {c}"]
        if fam in ("nxos", "arista"):
            c = f"ip route {net} {nh}"
            return [c if add else f"no {c}"]
        if fam == "procurve":
            c = f"ip route {net.network_address} {net.netmask} {nh}"
            return [c if add else f"no {c}"]
        if fam == "comware":
            c = f"ip route-static {net.network_address} {net.netmask} {nh}"
            return [c if add else f"undo {c}"]
        if fam == "junos":
            c = f"routing-options static route {net} next-hop {nh}"
            return [("set " if add else "delete ") + c]
        if fam == "mikrotik":
            if add:
                return [f"/ip route add dst-address={net} gateway={nh}"]
            return [f'/ip route remove [find dst-address="{net}" gateway={nh}]']
        if fam == "fortinet" and add:
            return ["config router static", "edit 0", f"set dst {net.network_address} {net.netmask}",
                    f"set gateway {nh}", "next", "end"]
        raise ConfigError("Route statique non gérée pour cette marque")

    if action == "interface":
        name = _s(p.get("name"), "interface", _IFACE, True)
        desc = _s(p.get("description"), "description") if p.get("description") is not None else None
        admin = p.get("admin")  # up | down | None
        mode = p.get("mode")  # access | trunk | None
        vlan = _vlan(p["vlan"]) if p.get("vlan") not in (None, "") else None
        trunk = _vlan_list(p.get("trunk_vlans")) if p.get("trunk_vlans") else ""
        ip, mask = (p.get("ip") or "").strip(), (p.get("mask") or "").strip()
        if ip:
            _ip(ip, "IP")

        if fam in ("cisco", "nxos", "arista"):
            out = [f"interface {name}"]
            if desc is not None:
                out.append(f"description {desc}" if desc else "no description")
            if mode == "access":
                out.append("switchport mode access")
                if vlan:
                    out.append(f"switchport access vlan {vlan}")
            elif mode == "trunk":
                out.append("switchport mode trunk")
                if trunk:
                    out.append(f"switchport trunk allowed vlan {trunk}")
            if ip:
                n = _net(ip, mask or "255.255.255.0")
                out.append(f"ip address {ip} {n.netmask}" if fam == "cisco" else f"ip address {ip}/{n.prefixlen}")
            if admin == "down":
                out.append("shutdown")
            elif admin == "up":
                out.append("no shutdown")
            return out

        if fam == "procurve":
            out = []
            iface = [f"interface {name}"]
            if desc is not None:
                iface.append(f"name {desc}" if desc else "no name")
            if admin == "down":
                iface.append("disable")
            elif admin == "up":
                iface.append("enable")
            if len(iface) > 1:
                out += iface + ["exit"]
            if mode == "access" and vlan:
                out += [f"vlan {vlan}", f"untagged {name}", "exit"]
            elif mode == "trunk" and trunk:
                for v in re.split(r",", trunk):
                    out += [f"vlan {v}", f"tagged {name}", "exit"]
            if ip:
                n = _net(ip, mask or "255.255.255.0")
                out += [f"vlan {vlan or 1}", f"ip address {ip} {n.netmask}", "exit"]
            return out

        if fam == "comware":
            out = [f"interface {name}"]
            if desc is not None:
                out.append(f"description {desc}" if desc else "undo description")
            if mode == "access":
                out.append("port link-type access")
                if vlan:
                    out.append(f"port access vlan {vlan}")
            elif mode == "trunk":
                out.append("port link-type trunk")
                if trunk:
                    out.append(f"port trunk permit vlan {trunk.replace(',', ' ').replace('-', ' to ')}")
            if ip:
                n = _net(ip, mask or "255.255.255.0")
                out.append(f"ip address {ip} {n.netmask}")
            if admin == "down":
                out.append("shutdown")
            elif admin == "up":
                out.append("undo shutdown")
            return out

        if fam == "junos":
            out = []
            if desc is not None:
                out.append(f'set interfaces {name} description "{desc}"' if desc
                           else f"delete interfaces {name} description")
            if admin == "down":
                out.append(f"set interfaces {name} disable")
            elif admin == "up":
                out.append(f"delete interfaces {name} disable")
            if mode == "access" and vlan:
                out.append(f"set interfaces {name} unit 0 family ethernet-switching vlan members {vlan}")
            if ip:
                n = _net(ip, mask or "255.255.255.0")
                out.append(f"set interfaces {name} unit 0 family inet address {ip}/{n.prefixlen}")
            return out

        if fam == "mikrotik":
            parts = []
            if desc is not None:
                parts.append(f'comment="{desc}"')
            if admin:
                parts.append(f"disabled={'yes' if admin == 'down' else 'no'}")
            out = [f'/interface set [find name="{name}"] ' + " ".join(parts)] if parts else []
            if ip:
                n = _net(ip, mask or "255.255.255.0")
                out.append(f'/ip address add address={ip}/{n.prefixlen} interface="{name}"')
            return out

        if fam == "fortinet":
            out = ["config system interface", f'edit "{name}"']
            if desc is not None:
                out.append(f'set description "{desc}"')
            if admin:
                out.append(f"set status {admin}")
            if ip:
                n = _net(ip, mask or "255.255.255.0")
                out.append(f"set ip {ip} {n.netmask}")
            return out + ["next", "end"]

        raise ConfigError("Configuration d'interface non gérée pour cette marque")

    raise ConfigError(f"Action inconnue : {action}")
