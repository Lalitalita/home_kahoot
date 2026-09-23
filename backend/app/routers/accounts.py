from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_owner
from app.models import ADMIN_PERMISSION_SECTIONS, Admin, AdminRole, Guest
from app.schemas import (
    AdminAccountCreate,
    AdminAccountPublic,
    AdminAccountResetPassword,
    AdminAccountUpdate,
)
from app.security import hash_password
from app.uploads import save_upload

router = APIRouter(prefix="/api/admin/accounts", tags=["accounts"])


def _to_public(admin: Admin, db: Session) -> AdminAccountPublic:
    guest_name = None
    if admin.guest_id:
        guest = db.get(Guest, admin.guest_id)
        guest_name = guest.name if guest else None
    return AdminAccountPublic(
        id=admin.id,
        username=admin.username,
        role=admin.role,
        permissions=[p for p in (admin.permissions or "").split(",") if p],
        photo_url=admin.photo_url,
        totp_enabled=admin.totp_enabled,
        guest_id=admin.guest_id,
        guest_name=guest_name,
        created_at=admin.created_at,
    )


def _clean_permissions(permissions: list[str]) -> str:
    return ",".join(p for p in permissions if p in ADMIN_PERMISSION_SECTIONS)


@router.get("", response_model=list[AdminAccountPublic])
def list_accounts(db: Session = Depends(get_db), owner: Admin = Depends(require_owner)):
    admins = db.query(Admin).order_by(Admin.created_at).all()
    return [_to_public(a, db) for a in admins]


@router.get("/sections")
def list_sections(owner: Admin = Depends(require_owner)):
    return ADMIN_PERMISSION_SECTIONS


@router.post("", response_model=AdminAccountPublic)
def create_account(
    payload: AdminAccountCreate,
    db: Session = Depends(get_db),
    owner: Admin = Depends(require_owner),
):
    if db.query(Admin).filter(Admin.username == payload.username).first() is not None:
        raise HTTPException(status_code=400, detail="Cet identifiant existe déjà")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Mot de passe trop court (8 caractères min.)")
    if not payload.guest_name.strip():
        raise HTTPException(status_code=400, detail="Le nom de l'invité est requis")

    guest = Guest(name=payload.guest_name.strip())
    db.add(guest)
    db.flush()  # get guest.id without a separate round trip

    admin = Admin(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=AdminRole.staff,
        permissions=_clean_permissions(payload.permissions),
        guest_id=guest.id,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return _to_public(admin, db)


@router.patch("/{account_id}", response_model=AdminAccountPublic)
def update_account(
    account_id: str,
    payload: AdminAccountUpdate,
    db: Session = Depends(get_db),
    owner: Admin = Depends(require_owner),
):
    admin = db.get(Admin, account_id)
    if admin is None:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    if admin.role == AdminRole.owner:
        raise HTTPException(status_code=400, detail="Le compte principal n'a pas de permissions à gérer")

    if payload.permissions is not None:
        admin.permissions = _clean_permissions(payload.permissions)
    db.commit()
    db.refresh(admin)
    return _to_public(admin, db)


@router.post("/{account_id}/reset-password", response_model=AdminAccountPublic)
def reset_account_password(
    account_id: str,
    payload: AdminAccountResetPassword,
    db: Session = Depends(get_db),
    owner: Admin = Depends(require_owner),
):
    admin = db.get(Admin, account_id)
    if admin is None:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    if admin.role == AdminRole.owner:
        raise HTTPException(status_code=400, detail="Utilise ton propre changement de mot de passe")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Mot de passe trop court (8 caractères min.)")

    admin.password_hash = hash_password(payload.new_password)
    admin.totp_secret = None
    admin.totp_enabled = False
    db.commit()
    db.refresh(admin)
    return _to_public(admin, db)


@router.post("/{account_id}/photo", response_model=AdminAccountPublic)
async def upload_account_photo(
    account_id: str,
    file: UploadFile,
    db: Session = Depends(get_db),
    owner: Admin = Depends(require_owner),
):
    admin = db.get(Admin, account_id)
    if admin is None:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    admin.photo_url = await save_upload(file, "admins")
    db.commit()
    db.refresh(admin)
    return _to_public(admin, db)


@router.delete("/{account_id}")
def delete_account(
    account_id: str, db: Session = Depends(get_db), owner: Admin = Depends(require_owner)
):
    admin = db.get(Admin, account_id)
    if admin is None:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    if admin.role == AdminRole.owner:
        raise HTTPException(status_code=400, detail="Impossible de supprimer le compte principal")
    db.delete(admin)
    db.commit()
    return {"ok": True}
