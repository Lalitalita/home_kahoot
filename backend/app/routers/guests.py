from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import Admin, Guest
from app.schemas import (
    GuestAdmin,
    GuestCreate,
    GuestPublic,
    GuestSelf,
    GuestSelfUpdate,
    GuestUpdateAdmin,
)
from app.uploads import save_upload

router = APIRouter(prefix="/api", tags=["guests"])


def _get_guest_by_code(access_code: str, db: Session) -> Guest:
    guest = db.query(Guest).filter(Guest.access_code == access_code).first()
    if guest is None:
        raise HTTPException(status_code=404, detail="Invité introuvable")
    return guest


# ---------- Public: guest list (discover who else is coming) ----------


@router.get("/guests", response_model=list[GuestPublic])
def list_guests_public(db: Session = Depends(get_db)):
    guests = db.query(Guest).order_by(Guest.name).all()
    return guests


# ---------- Self-service: a guest manages their own info via their code ----------


@router.get("/guests/me/{access_code}", response_model=GuestSelf)
def get_my_guest_profile(access_code: str, db: Session = Depends(get_db)):
    return _get_guest_by_code(access_code, db)


@router.patch("/guests/me/{access_code}", response_model=GuestSelf)
def update_my_guest_profile(
    access_code: str, payload: GuestSelfUpdate, db: Session = Depends(get_db)
):
    guest = _get_guest_by_code(access_code, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(guest, field, value)
    db.commit()
    db.refresh(guest)
    return guest


@router.post("/guests/me/{access_code}/photo", response_model=GuestSelf)
async def upload_my_guest_photo(
    access_code: str, file: UploadFile, db: Session = Depends(get_db)
):
    guest = _get_guest_by_code(access_code, db)
    guest.photo_url = await save_upload(file, "guests")
    db.commit()
    db.refresh(guest)
    return guest


# ---------- Admin: full CRUD ----------


@router.get("/admin/guests", response_model=list[GuestAdmin])
def list_guests_admin(db: Session = Depends(get_db), admin: Admin = Depends(require_permission("guests"))):
    return db.query(Guest).order_by(Guest.created_at).all()


@router.post("/admin/guests", response_model=GuestAdmin)
def create_guest(
    payload: GuestCreate, db: Session = Depends(get_db), admin: Admin = Depends(require_permission("guests"))
):
    guest = Guest(**payload.model_dump())
    db.add(guest)
    db.commit()
    db.refresh(guest)
    return guest


@router.patch("/admin/guests/{guest_id}", response_model=GuestAdmin)
def update_guest_admin(
    guest_id: str,
    payload: GuestUpdateAdmin,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("guests")),
):
    guest = db.get(Guest, guest_id)
    if guest is None:
        raise HTTPException(status_code=404, detail="Invité introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(guest, field, value)
    db.commit()
    db.refresh(guest)
    return guest


@router.post("/admin/guests/{guest_id}/photo", response_model=GuestAdmin)
async def upload_guest_photo_admin(
    guest_id: str,
    file: UploadFile,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("guests")),
):
    guest = db.get(Guest, guest_id)
    if guest is None:
        raise HTTPException(status_code=404, detail="Invité introuvable")
    guest.photo_url = await save_upload(file, "guests")
    db.commit()
    db.refresh(guest)
    return guest


@router.delete("/admin/guests/{guest_id}")
def delete_guest(
    guest_id: str, db: Session = Depends(get_db), admin: Admin = Depends(require_permission("guests"))
):
    guest = db.get(Guest, guest_id)
    if guest is None:
        raise HTTPException(status_code=404, detail="Invité introuvable")
    db.delete(guest)
    db.commit()
    return {"ok": True}
