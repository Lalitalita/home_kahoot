from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Admin, AppSettings, ScheduleItem
from app.schemas import (
    DayScheduleSettings,
    DayStartUpdate,
    ScheduleItemAdmin,
    ScheduleItemCreate,
    ScheduleItemUpdate,
)

router = APIRouter(prefix="/api/admin/schedule", tags=["schedule"])


def _get_or_create_settings(db: Session) -> AppSettings:
    settings_row = db.get(AppSettings, "singleton")
    if settings_row is None:
        settings_row = AppSettings(id="singleton")
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


@router.get("/day-start", response_model=DayScheduleSettings)
def get_day_start(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return _get_or_create_settings(db)


@router.patch("/day-start", response_model=DayScheduleSettings)
def set_day_start(
    payload: DayStartUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    settings_row = _get_or_create_settings(db)
    settings_row.day_start_time = payload.day_start_time
    db.commit()
    db.refresh(settings_row)
    return settings_row


@router.get("/items", response_model=list[ScheduleItemAdmin])
def list_items(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return db.query(ScheduleItem).order_by(ScheduleItem.order_index).all()


@router.post("/items", response_model=ScheduleItemAdmin)
def create_item(
    payload: ScheduleItemCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    max_order = db.query(ScheduleItem).count()
    item = ScheduleItem(**payload.model_dump(), order_index=max_order)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=ScheduleItemAdmin)
def update_item(
    item_id: str,
    payload: ScheduleItemUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    item = db.get(ScheduleItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Élément introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.post("/items/{item_id}/move", response_model=list[ScheduleItemAdmin])
def move_item(
    item_id: str,
    direction: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if direction not in ("up", "down"):
        raise HTTPException(status_code=400, detail="direction doit être 'up' ou 'down'")

    items = db.query(ScheduleItem).order_by(ScheduleItem.order_index).all()
    index = next((i for i, it in enumerate(items) if it.id == item_id), None)
    if index is None:
        raise HTTPException(status_code=404, detail="Élément introuvable")

    swap_index = index - 1 if direction == "up" else index + 1
    if 0 <= swap_index < len(items):
        items[index].order_index, items[swap_index].order_index = (
            items[swap_index].order_index,
            items[index].order_index,
        )
        db.commit()

    return db.query(ScheduleItem).order_by(ScheduleItem.order_index).all()


@router.delete("/items/{item_id}")
def delete_item(
    item_id: str, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)
):
    item = db.get(ScheduleItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Élément introuvable")
    db.delete(item)
    db.commit()
    return {"ok": True}
