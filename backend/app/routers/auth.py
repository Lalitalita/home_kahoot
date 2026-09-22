import io

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Admin
from app.schemas import (
    Confirm2FASetupRequest,
    LoginRequest,
    LoginResponse,
    TokenResponse,
    Verify2FARequest,
)
from app.security import (
    create_access_token,
    create_challenge_token,
    decode_token,
    new_totp_secret,
    totp_provisioning_uri,
    verify_password,
    verify_totp_code,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _decode_challenge(token: str, purpose: str, db: Session) -> Admin:
    payload = decode_token(token)
    if payload is None or payload.get("type") != "challenge" or payload.get("purpose") != purpose:
        raise HTTPException(status_code=401, detail="Jeton invalide ou expiré")
    admin = db.get(Admin, payload.get("sub"))
    if admin is None:
        raise HTTPException(status_code=401, detail="Administrateur introuvable")
    return admin


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.username == payload.username).first()
    if admin is None or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")

    if not admin.totp_enabled:
        if not admin.totp_secret:
            admin.totp_secret = new_totp_secret()
            db.commit()
        challenge = create_challenge_token(admin.id, "setup_2fa")
        return LoginResponse(
            requires_2fa_setup=True,
            challenge_token=challenge,
            provisioning_uri=totp_provisioning_uri(admin.totp_secret, admin.username),
        )

    challenge = create_challenge_token(admin.id, "verify_2fa")
    return LoginResponse(requires_2fa_setup=False, challenge_token=challenge)


@router.get("/2fa-qr")
def get_2fa_qr(token: str = Query(...), db: Session = Depends(get_db)):
    admin = _decode_challenge(token, "setup_2fa", db)
    if not admin.totp_secret:
        raise HTTPException(status_code=400, detail="2FA non initialisée")

    uri = totp_provisioning_uri(admin.totp_secret, admin.username)
    img = qrcode.make(uri)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="image/png")


@router.post("/setup-2fa/confirm", response_model=TokenResponse)
def confirm_setup(payload: Confirm2FASetupRequest, db: Session = Depends(get_db)):
    admin = _decode_challenge(payload.challenge_token, "setup_2fa", db)
    if not admin.totp_secret or not verify_totp_code(admin.totp_secret, payload.code):
        raise HTTPException(status_code=401, detail="Code de vérification incorrect")

    admin.totp_enabled = True
    db.commit()
    return TokenResponse(access_token=create_access_token(admin.id))


@router.post("/verify-2fa", response_model=TokenResponse)
def verify_2fa(payload: Verify2FARequest, db: Session = Depends(get_db)):
    admin = _decode_challenge(payload.challenge_token, "verify_2fa", db)
    if not admin.totp_secret or not verify_totp_code(admin.totp_secret, payload.code):
        raise HTTPException(status_code=401, detail="Code incorrect")

    return TokenResponse(access_token=create_access_token(admin.id))


@router.get("/me")
def me(admin: Admin = Depends(get_current_admin)):
    return {"username": admin.username}
