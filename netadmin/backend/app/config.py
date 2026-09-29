import os
import secrets
from pathlib import Path

DATA_DIR = Path(os.getenv("DATA_DIR", "/data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'netadmin.db'}")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "changeme")
TOKEN_HOURS = int(os.getenv("TOKEN_HOURS", "12"))
STATIC_DIR = Path(os.getenv("STATIC_DIR", str(Path(__file__).resolve().parent.parent / "static")))


def _secret_key() -> str:
    """SECRET_KEY from env, otherwise generated once and kept in the data volume."""
    key = os.getenv("SECRET_KEY", "").strip()
    if key:
        return key
    f = DATA_DIR / "secret.key"
    if f.exists():
        return f.read_text().strip()
    key = secrets.token_urlsafe(48)
    f.write_text(key)
    f.chmod(0o600)
    return key


SECRET_KEY = _secret_key()
