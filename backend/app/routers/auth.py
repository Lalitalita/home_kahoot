import io

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Admin, Guest
from app.schemas import (
    AdminMe,
    ChangePasswordRequest,
    Confirm2FAResetRequest,
    Confirm2FASetupRequest,
    LoginRequest,
    LoginResponse,
    Start2FAResetRequest,
    Start2FAResetResponse,
    TokenResponse,
    Verify2FARequest,
)
from app.security import (
    create_access_token,
    create_challenge_token,
    decode_token,
    hash_password,
    new_totp_secret,
    totp_provisioning_uri,
    verify_password,
    verify_totp_code,
)
from app.uploads import save_upload

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _admin_to_me(admin: Admin, db: Session) -> AdminMe:
    guest_photo_url = None
    if admin.guest_id:
        guest = db.get(Guest, admin.guest_id)
        guest_photo_url = guest.photo_url if guest else None
    return AdminMe(
        id=admin.id,
        username=admin.username,
        role=admin.role,
        permissions=[p for p in (admin.permissions or "").split(",") if p],
        photo_url=admin.photo_url or guest_photo_url,
        totp_enabled=admin.totp_enabled,
    )


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


@router.get("/me", response_model=AdminMe)
def me(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return _admin_to_me(admin, db)


@router.patch("/me/password", response_model=AdminMe)
def change_my_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if not verify_password(payload.current_password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe est trop court (8 caractères min.)")

    admin.password_hash = hash_password(payload.new_password)
    db.commit()
    return _admin_to_me(admin, db)


@router.post("/me/2fa/start", response_model=Start2FAResetResponse)
def start_my_2fa_reset(
    payload: Start2FAResetRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if not verify_password(payload.current_password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect")

    admin.totp_secret = new_totp_secret()
    admin.totp_enabled = False
    db.commit()
    return Start2FAResetResponse(
        provisioning_uri=totp_provisioning_uri(admin.totp_secret, admin.username)
    )


@router.get("/me/2fa-qr")
def my_2fa_qr(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    if not admin.totp_secret:
        raise HTTPException(status_code=400, detail="Lance d'abord la réinitialisation de la 2FA")
    uri = totp_provisioning_uri(admin.totp_secret, admin.username)
    img = qrcode.make(uri)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="image/png")


@router.post("/me/2fa/confirm", response_model=AdminMe)
def confirm_my_2fa_reset(
    payload: Confirm2FAResetRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if not admin.totp_secret or not verify_totp_code(admin.totp_secret, payload.code):
        raise HTTPException(status_code=401, detail="Code incorrect")
    admin.totp_enabled = True
    db.commit()
    return _admin_to_me(admin, db)


@router.post("/me/photo", response_model=AdminMe)
async def upload_my_photo(
    file: UploadFile, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)
):
    admin.photo_url = await save_upload(file, "admins")
    db.commit()
    return _admin_to_me(admin, db)
