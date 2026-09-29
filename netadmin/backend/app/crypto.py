import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from .config import SECRET_KEY

_fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(SECRET_KEY.encode()).digest()))


def encrypt(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode() if value else ""


def decrypt(value: str) -> str:
    if not value:
        return ""
    try:
        return _fernet.decrypt(value.encode()).decode()
    except InvalidToken:
        return ""
