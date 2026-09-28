from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import require_permission
from app.models import Admin, AppSettings
from app.quiz_engine import engine
from app.schemas import AppSettingsPublic, PartyInfoUpdate
from app.ws_manager import manager

router = APIRouter(prefix="/api", tags=["settings"])


def _get_or_create_settings(db: Session) -> AppSettings:
    settings_row = db.get(AppSettings, "singleton")
    if settings_row is None:
        settings_row = AppSettings(id="singleton", party_mode_active=False)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


@router.get("/settings", response_model=AppSettingsPublic)
def get_settings_public(db: Session = Depends(get_db)):
    settings_row = _get_or_create_settings(db)
    return AppSettingsPublic(
        party_mode_active=settings_row.party_mode_active,
        party_location_name=settings_row.party_location_name,
        party_address=settings_row.party_address,
        party_date=settings_row.party_date,
        party_time=settings_row.party_time,
        gallery_url=settings_row.gallery_url,
        gallery_password=get_settings().gallery_password or None,
    )


class PartyModeUpdate(BaseModel):
    active: bool


@router.post("/admin/settings/party-mode", response_model=AppSettingsPublic)
async def set_party_mode(
    payload: PartyModeUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("party")),
):
    settings_row = _get_or_create_settings(db)
    settings_row.party_mode_active = payload.active
    db.commit()
    db.refresh(settings_row)

    if payload.active:
        await engine.reset()

    await manager.broadcast({"type": "party_mode", "active": payload.active})
    return settings_row


@router.patch("/admin/settings/party-info", response_model=AppSettingsPublic)
def set_party_info(
    payload: PartyInfoUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("planning")),
):
    settings_row = _get_or_create_settings(db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings_row, field, value)
    db.commit()
    db.refresh(settings_row)
    return settings_row
