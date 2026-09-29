"""Demo network: fake Cisco devices producing realistic CLI output, to try the app without hardware."""
from datetime import datetime

from .crypto import encrypt
from .models import Device, Link

# name -> spec.  ports: (port, description, status, vlan)  hosts: (port, vlan, mac, ip)
# neighbors: (local_port, remote_name, remote_port, remote_ip)
NET = {
    "R-Core": dict(kind="router", ip="10.0.0.1", ports=[
        ("Gi0/0", "Vers Internet", "connected", "routed"), ("Gi0/1", "Vers SW-Core", "connected", "routed")],
        neighbors=[("Gi0/1", "SW-Core", "Gi1/0/48", "10.0.0.2")], hosts=[]),
    "SW-Core": dict(kind="switch", ip="10.0.0.2", ports=[
        ("Gi1/0/1", "Vers SW-Etage1", "connected", "trunk"), ("Gi1/0/2", "Vers SW-Etage2", "connected", "trunk"),
        ("Gi1/0/10", "NAS", "connected", "20"), ("Gi1/0/48", "Vers R-Core", "connected", "trunk")],
        neighbors=[("Gi1/0/1", "SW-Etage1", "Gi1/0/48", "10.0.0.3"), ("Gi1/0/2", "SW-Etage2", "Gi1/0/48", "10.0.0.4"),
                   ("Gi1/0/48", "R-Core", "Gi0/1", "10.0.0.1")],
        hosts=[("Gi1/0/10", 20, "0011.2233.4410", "10.0.20.10")]),
    "SW-Etage1": dict(kind="switch", ip="10.0.0.3", ports=[
        ("Gi1/0/1", "PC Compta", "connected", "10"), ("Gi1/0/2", "PC Direction", "connected", "10"),
        ("Gi1/0/3", "Imprimante", "connected", "30"), ("Gi1/0/4", "", "notconnect", "10"),
        ("Gi1/0/48", "Vers SW-Core", "connected", "trunk")],
        neighbors=[("Gi1/0/48", "SW-Core", "Gi1/0/1", "10.0.0.2")],
        hosts=[("Gi1/0/1", 10, "0011.2233.4401", "10.0.10.11"), ("Gi1/0/2", 10, "0011.2233.4402", "10.0.10.12"),
               ("Gi1/0/3", 30, "0011.2233.4403", "10.0.30.20")]),
    "SW-Etage2": dict(kind="switch", ip="10.0.0.4", ports=[
        ("Gi1/0/1", "PC Accueil", "connected", "10"), ("Gi1/0/2", "Borne Wi-Fi", "connected", "trunk"),
        ("Gi1/0/48", "Vers SW-Core", "connected", "trunk")],
        neighbors=[("Gi1/0/48", "SW-Core", "Gi1/0/2", "10.0.0.2")],
        hosts=[("Gi1/0/1", 10, "0011.2233.4404", "10.0.10.13"), ("Gi1/0/2", 10, "0011.2233.4405", "10.0.10.50")]),
}

# Unmanaged nodes and their links (name, kind, ip) / (a, a_port, b, b_port)
EMPTY = [("Internet", "cloud", ""), ("NAS", "server", "10.0.20.10"), ("PC Compta", "pc", "10.0.10.11"),
         ("PC Direction", "pc", "10.0.10.12"), ("Imprimante", "printer", "10.0.30.20"),
         ("PC Accueil", "pc", "10.0.10.13"), ("Borne Wi-Fi", "ap", "10.0.10.50")]
LINKS = [
    ("Internet", "", "R-Core", "Gi0/0"), ("R-Core", "Gi0/1", "SW-Core", "Gi1/0/48"),
    ("SW-Core", "Gi1/0/1", "SW-Etage1", "Gi1/0/48"), ("SW-Core", "Gi1/0/2", "SW-Etage2", "Gi1/0/48"),
    ("SW-Core", "Gi1/0/10", "NAS", "eth0"), ("SW-Etage1", "Gi1/0/1", "PC Compta", "eth0"),
    ("SW-Etage1", "Gi1/0/2", "PC Direction", "eth0"), ("SW-Etage1", "Gi1/0/3", "Imprimante", "eth0"),
    ("SW-Etage2", "Gi1/0/1", "PC Accueil", "eth0"), ("SW-Etage2", "Gi1/0/2", "Borne Wi-Fi", "eth0"),
]


def _full(p: str) -> str:
    return p.replace("Gi", "GigabitEthernet", 1) if p.startswith("Gi") else p


class DemoSession:
    def __init__(self, dev: Device):
        self.dev = dev
        self.spec = NET.get(dev.name) or dict(kind=dev.kind, ip=dev.host or "10.0.0.99", ports=[], neighbors=[], hosts=[])

    def send(self, cmd: str) -> str:
        c, s = " ".join(cmd.lower().split()), self.spec
        n = self.dev.name
        if c == "show version":
            return (f"Cisco IOS XE Software, Version 16.12.4\nROM: IOS-XE ROMMON\n\n{n} uptime is 12 weeks, 3 days, "
                    "4 hours, 12 minutes\nSystem returned to ROM by reload\nSystem image file is "
                    '"flash:packages.conf"\ncisco C9300-48P (X86) processor with 1392 KB of memory\n'
                    "Configuration register is 0x102\n")
        if c == "show interfaces status":
            if s["kind"] == "router":
                raise RuntimeError("% Invalid input detected at '^' marker.")
            lines = ["Port      Name               Status       Vlan       Duplex  Speed Type"]
            for port, desc, st, vlan in s["ports"]:
                lines.append(f"{port:<9} {desc[:18]:<18} {st:<12} {vlan:<10} a-full  a-1000 10/100/1000BaseTX")
            return "\n".join(lines)
        if c == "show ip interface brief":
            lines = ["Interface              IP-Address      OK? Method Status                Protocol"]
            for i, (port, desc, st, vlan) in enumerate(s["ports"]):
                ip = f"192.0.2.{i + 2}" if s["kind"] == "router" else "unassigned"
                up = "up" if st == "connected" else "down"
                lines.append(f"{_full(port):<22} {ip:<15} YES manual {'up' if up == 'up' else 'down':<21} {up}")
            lines.append(f"{'Vlan1':<22} {s['ip']:<15} YES manual up                    up")
            return "\n".join(lines)
        if c in ("show vlan brief", "show vlan"):
            return ("VLAN Name                             Status    Ports\n---- -------------------------------- "
                    "--------- -------------------------------\n1    default                          active    \n"
                    "10   Utilisateurs                     active    Gi1/0/1, Gi1/0/2, Gi1/0/4\n"
                    "20   Serveurs                         active    Gi1/0/10\n30   Imprimantes                      active    Gi1/0/3")
        if c == "show lldp neighbors detail":
            raise RuntimeError("% Invalid input detected at '^' marker.")
        if c == "show cdp neighbors detail":
            blocks = []
            for lp, rn, rp, rip in s["neighbors"]:
                blocks.append(f"-------------------------\nDevice ID: {rn}\nEntry address(es): \n  IP address: {rip}\n"
                              f"Platform: cisco C9300-48P,  Capabilities: Router Switch IGMP \n"
                              f"Interface: {_full(lp)},  Port ID (outgoing port): {_full(rp)}\nHoldtime : 150 sec\n\n"
                              "Version :\nCisco IOS Software, Version 16.12.4\n\nadvertisement version: 2\n")
            return "\n".join(blocks) or "Total cdp entries displayed : 0"
        if c in ("show mac address-table", "show mac-address-table"):
            lines = ["          Mac Address Table", "-------------------------------------------", "",
                     "Vlan    Mac Address       Type        Ports", "----    -----------       --------    -----"]
            for port, vlan, mac, ip in s["hosts"]:
                lines.append(f"{vlan:>4}    {mac}    DYNAMIC     {port}")
            lines.append(f"Total Mac Addresses for this criterion: {len(s['hosts'])}")
            return "\n".join(lines)
        if c == "show ip arp":
            lines = ["Protocol  Address          Age (min)  Hardware Addr   Type   Interface"]
            for port, vlan, mac, ip in s["hosts"]:
                lines.append(f"Internet  {ip:<16} {5:>6}   {mac}  ARPA   Vlan{vlan}")
            return "\n".join(lines)
        if c == "show ip route":
            return ("Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP\n\n"
                    "Gateway of last resort is 192.0.2.1 to network 0.0.0.0\n\n"
                    "S*    0.0.0.0/0 [1/0] via 192.0.2.1\n      10.0.0.0/8 is variably subnetted, 2 subnets, 2 masks\n"
                    "C        10.0.0.0/24 is directly connected, Vlan1\nL        10.0.0.1/32 is directly connected, Vlan1")
        if c == "show running-config":
            cfg = [f"hostname {self.dev.name}", "!"]
            for port, desc, st, vlan in s["ports"]:
                cfg += [f"interface {_full(port)}", f" description {desc}" if desc else " no description"]
                if vlan.isdigit():
                    cfg += [" switchport mode access", f" switchport access vlan {vlan}"]
                if st != "connected":
                    cfg.append(" shutdown")
                cfg.append("!")
            return "\n".join(cfg + ["end"])
        raise RuntimeError("% Invalid input detected at '^' marker.")

    def send_config(self, cmds):
        return "(démo) commandes simulées, aucun appareil réel :\n" + "\n".join(cmds)

    def save(self):
        return "(démo) [OK]"

    def close(self):
        pass


def seed(db) -> int:
    """Insert the demo network (idempotent by device name). Returns the number of devices created."""
    by_name = {d.name: d for d in db.query(Device).all()}
    created = 0
    for name, spec in NET.items():
        if name in by_name:
            continue
        d = Device(name=name, kind=spec["kind"], managed=True, driver="cisco_ios", conn_type="demo",
                   host=spec["ip"], username="demo", password_enc=encrypt("demo"), ip=spec["ip"],
                   status="up", last_seen=datetime.utcnow())
        db.add(d)
        by_name[name] = d
        created += 1
    for name, kind, ip in EMPTY:
        if name in by_name:
            continue
        d = Device(name=name, kind=kind, managed=False, ip=ip)
        db.add(d)
        by_name[name] = d
        created += 1
    db.flush()
    for a, ap, b, bp in LINKS:
        if not db.query(Link).filter_by(a_id=by_name[a].id, b_id=by_name[b].id, a_port=ap, b_port=bp).first():
            db.add(Link(a_id=by_name[a].id, b_id=by_name[b].id, a_port=ap, b_port=bp, source="manual"))
    db.commit()
    return created
