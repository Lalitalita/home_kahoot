from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
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
def get_day_start(db: Session = Depends(get_db), admin: Admin = Depends(require_permission("planning"))):
    return _get_or_create_settings(db)


@router.patch("/day-start", response_model=DayScheduleSettings)
def set_day_start(
    payload: DayStartUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("planning")),
):
    settings_row = _get_or_create_settings(db)
    settings_row.day_start_time = payload.day_start_time
    db.commit()
    db.refresh(settings_row)
    return settings_row


@router.get("/items", response_model=list[ScheduleItemAdmin])
def list_items(db: Session = Depends(get_db), admin: Admin = Depends(require_permission("planning"))):
    return db.query(ScheduleItem).order_by(ScheduleItem.order_index, ScheduleItem.created_at).all()


@router.post("/items", response_model=ScheduleItemAdmin)
def create_item(
    payload: ScheduleItemCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("planning")),
):
    # Count-based order_index used to collide with existing rows once any
    # item had been deleted (e.g. 3 items 0/1/2, delete #1 → count() is 2,
    # colliding with the item still at order_index 2), which silently broke
    # reordering past that point. max()+1 can never collide.
    max_order = db.query(func.max(ScheduleItem.order_index)).scalar()
    next_order = 0 if max_order is None else max_order + 1
    item = ScheduleItem(**payload.model_dump(), order_index=next_order)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=ScheduleItemAdmin)
def update_item(
    item_id: str,
    payload: ScheduleItemUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("planning")),
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
    admin: Admin = Depends(require_permission("planning")),
):
    if direction not in ("up", "down"):
        raise HTTPException(status_code=400, detail="direction doit être 'up' ou 'down'")

    items = db.query(ScheduleItem).order_by(ScheduleItem.order_index, ScheduleItem.created_at).all()
    index = next((i for i, it in enumerate(items) if it.id == item_id), None)
    if index is None:
        raise HTTPException(status_code=404, detail="Élément introuvable")

    # Renumber sequentially first — self-heals any duplicate order_index
    # values left over from the old count()-based assignment (which used to
    # collide after a delete and silently no-op every swap past that point).
    for i, it in enumerate(items):
        it.order_index = i

    swap_index = index - 1 if direction == "up" else index + 1
    if 0 <= swap_index < len(items):
        items[index].order_index, items[swap_index].order_index = (
            items[swap_index].order_index,
            items[index].order_index,
        )

    db.commit()
    return db.query(ScheduleItem).order_by(ScheduleItem.order_index, ScheduleItem.created_at).all()


@router.delete("/items/{item_id}")
def delete_item(
    item_id: str, db: Session = Depends(get_db), admin: Admin = Depends(require_permission("planning"))
):
    item = db.get(ScheduleItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Élément introuvable")
    db.delete(item)
    db.commit()
    return {"ok": True}
