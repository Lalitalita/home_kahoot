"""Device sessions: SSH (netmiko), serial console (pyserial) and a built-in demo."""
import re
import threading
import time
from contextlib import contextmanager

from .crypto import decrypt
from .models import Device
from .profiles import PROFILES

_locks: dict[int, threading.Lock] = {}
_locks_guard = threading.Lock()


class DeviceError(Exception):
    pass


def _lock_for(device_id: int) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(device_id, threading.Lock())


class SSHSession:
    def __init__(self, dev: Device):
        from netmiko import ConnectHandler

        prof = PROFILES[dev.driver]
        params = dict(
            device_type=prof["netmiko"], host=dev.host, port=dev.ssh_port or 22,
            username=dev.username, password=decrypt(dev.password_enc),
            secret=decrypt(dev.secret_enc), conn_timeout=15, auth_timeout=20, banner_timeout=20,
            fast_cli=False,
        )
        try:
            self.conn = ConnectHandler(**params)
            if params["secret"]:
                self.conn.enable()
        except Exception as e:  # netmiko raises many different exception types
            raise DeviceError(f"Connexion SSH impossible : {e}") from e
        self.family = prof["family"]

    def send(self, cmd: str) -> str:
        try:
            return self.conn.send_command(cmd, read_timeout=90, strip_prompt=True, strip_command=True)
        except Exception as e:
            raise DeviceError(f"Commande '{cmd}' échouée : {e}") from e

    def send_config(self, cmds: list[str]) -> str:
        try:
            if self.family == "junos":
                out = self.conn.send_config_set(cmds, exit_config_mode=False)
                out += self.conn.commit()
                self.conn.exit_config_mode()
                return out
            if self.family in ("mikrotik", "fortinet", "generic"):
                return "\n".join(self.conn.send_command(c, read_timeout=60) for c in cmds)
            return self.conn.send_config_set(cmds, read_timeout=90)
        except Exception as e:
            raise DeviceError(f"Configuration échouée : {e}") from e

    def save(self) -> str:
        if self.family in ("junos", "mikrotik", "fortinet", "generic"):
            return ""
        try:
            return self.conn.save_config()
        except Exception as e:
            raise DeviceError(f"Sauvegarde échouée : {e}") from e

    def close(self):
        try:
            self.conn.disconnect()
        except Exception:
            pass


class SerialSession:
    """Minimal vendor-agnostic console driver (works for every brand, unlike netmiko's serial mode)."""

    PROMPT = re.compile(r"(?:^|\n)[^\r\n]{0,80}?[#>\]\$]\s?$")
    MORE = re.compile(r"(--More--|---- More ----|-- MORE --|<--- More --->)", re.I)

    def __init__(self, dev: Device):
        import serial

        self.prof = PROFILES[dev.driver]
        self.username, self.password = dev.username, decrypt(dev.password_enc)
        self.secret = decrypt(dev.secret_enc)
        try:
            self.ser = serial.Serial(dev.serial_port, dev.baudrate or 9600, timeout=0.2)
        except Exception as e:
            raise DeviceError(f"Port série {dev.serial_port} inaccessible : {e}") from e
        try:
            self._login()
            if self.prof["paging"]:
                self.send(self.prof["paging"])
        except DeviceError:
            self.close()
            raise

    def _read(self, timeout=8.0, until=None) -> str:
        buf, end, last = "", time.time() + timeout, time.time()
        while time.time() < end:
            chunk = self.ser.read(4096)
            if chunk:
                buf += chunk.decode(errors="replace")
                last = time.time()
                if self.MORE.search(buf[-40:]):
                    self.ser.write(b" ")
                    buf = self.MORE.sub("", buf)
                    continue
            elif buf and time.time() - last > 0.4:
                tail = buf.replace("\r", "")
                if (until or self.PROMPT).search(tail):
                    break
        return buf.replace("\r", "")

    def _login(self):
        self.ser.reset_input_buffer()
        self.ser.write(b"\r\n")
        for _ in range(6):
            out = self._read(timeout=4, until=re.compile(r"(login|username|password)\s*:\s*$|[#>\]\$]\s?$", re.I))
            low = out.lower().rstrip()
            if re.search(r"(login|username)\s*:$", low):
                self.ser.write(f"{self.username}\r\n".encode())
            elif low.endswith("password:"):
                self.ser.write(f"{self.password}\r\n".encode())
            elif low.endswith(">") and self.secret and self.prof["family"] in ("cisco", "nxos", "arista"):
                self.ser.write(b"enable\r\n")
                self._read(timeout=3, until=re.compile(r"password\s*:\s*$", re.I))
                self.ser.write(f"{self.secret}\r\n".encode())
            elif self.PROMPT.search(out):
                return
            else:
                self.ser.write(b"\r\n")
        raise DeviceError("Pas de prompt sur la console (vérifie le port, le débit et les identifiants)")

    def send(self, cmd: str) -> str:
        self.ser.reset_input_buffer()
        self.ser.write(f"{cmd}\r\n".encode())
        out = self._read(timeout=60).split("\n")
        if out and cmd.strip() in out[0]:
            out = out[1:]
        if out and self.PROMPT.search("\n" + out[-1]):
            out = out[:-1]
        return "\n".join(out).strip("\n")

    def send_config(self, cmds: list[str]) -> str:
        p = self.prof
        seq = ([p["cfg_enter"]] if p["cfg_enter"] else []) + cmds + ([p["cfg_exit"]] if p["cfg_exit"] else [])
        return "\n".join(self.send(c) for c in seq)

    def save(self) -> str:
        return self.send(self.prof["save"]) if self.prof["save"] else ""

    def close(self):
        try:
            self.ser.close()
        except Exception:
            pass


@contextmanager
def open_session(dev: Device):
    """Serialises access per device (a console / VTY should not be shared between requests)."""
    from .demo import DemoSession

    if not dev.managed:
        raise DeviceError("Cet appareil est une machine vide : aucune connexion possible")
    lock = _lock_for(dev.id)
    if not lock.acquire(timeout=120):
        raise DeviceError("Appareil occupé par une autre opération")
    sess = None
    try:
        if dev.conn_type == "demo":
            sess = DemoSession(dev)
        elif dev.conn_type == "serial":
            if not dev.serial_port:
                raise DeviceError("Port série non renseigné")
            sess = SerialSession(dev)
        else:
            if not dev.host:
                raise DeviceError("Adresse / hôte non renseigné")
            sess = SSHSession(dev)
        yield sess
    finally:
        if sess:
            sess.close()
        lock.release()
