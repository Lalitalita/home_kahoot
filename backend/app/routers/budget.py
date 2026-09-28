import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import Admin, AppSettings, BudgetCategory, BudgetItem, Guest, ScheduleItem
from app.schemas import (
    AllergyConflict,
    BudgetItemAdmin,
    BudgetItemCreate,
    BudgetItemTaskLinksUpdate,
    BudgetItemUpdate,
    BudgetSummary,
    BudgetTargetUpdate,
    LinkedTask,
)

router = APIRouter(prefix="/api/admin/budget", tags=["budget"])

TAG_SPLIT_RE = re.compile(r"[,;/]")


def _get_or_create_settings(db: Session) -> AppSettings:
    settings_row = db.get(AppSettings, "singleton")
    if settings_row is None:
        settings_row = AppSettings(id="singleton", party_mode_active=False)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


def _conflicts_for_item(item: BudgetItem, guests: list[Guest]) -> list[AllergyConflict]:
    if item.category != BudgetCategory.food or not item.allergens:
        return []

    tags = [t.strip().lower() for t in TAG_SPLIT_RE.split(item.allergens) if t.strip()]
    if not tags:
        return []

    conflicts: list[AllergyConflict] = []
    for guest in guests:
        guest_text = " ".join(
            filter(None, [guest.allergies, guest.intolerances])
        ).lower()
        if not guest_text:
            continue
        for tag in tags:
            if tag in guest_text:
                conflicts.append(
                    AllergyConflict(
                        guest_id=guest.id,
                        guest_name=guest.name,
                        matched_allergen=tag,
                        guest_allergy_text=" / ".join(
                            filter(None, [guest.allergies, guest.intolerances])
                        ),
                    )
                )
                break
    return conflicts


def _serialize(item: BudgetItem, guests: list[Guest]) -> BudgetItemAdmin:
    data = BudgetItemAdmin.model_validate(item)
    data.conflicts = _conflicts_for_item(item, guests)
    data.linked_tasks = [LinkedTask.model_validate(t) for t in item.schedule_items]
    data.linked_minutes = sum(t.duration_minutes for t in item.schedule_items)
    return data


@router.get("/items", response_model=list[BudgetItemAdmin])
def list_items(
    category: BudgetCategory | None = Query(default=None),
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("budget")),
):
    query = db.query(BudgetItem)
    if category is not None:
        query = query.filter(BudgetItem.category == category)
    items = query.order_by(BudgetItem.created_at).all()
    guests = db.query(Guest).all()
    return [_serialize(item, guests) for item in items]


@router.post("/items", response_model=BudgetItemAdmin)
def create_item(
    payload: BudgetItemCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("budget")),
):
    item = BudgetItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    guests = db.query(Guest).all()
    return _serialize(item, guests)


@router.patch("/items/{item_id}", response_model=BudgetItemAdmin)
def update_item(
    item_id: str,
    payload: BudgetItemUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("budget")),
):
    item = db.get(BudgetItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Élément introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    guests = db.query(Guest).all()
    return _serialize(item, guests)


@router.delete("/items/{item_id}")
def delete_item(
    item_id: str, db: Session = Depends(get_db), admin: Admin = Depends(require_permission("budget"))
):
    item = db.get(BudgetItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Élément introuvable")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.get("/tasks", response_model=list[LinkedTask])
def list_available_tasks(
    db: Session = Depends(get_db), admin: Admin = Depends(require_permission("budget"))
):
    # Minimal read-only view of the planning blocks, just enough to build
    # the task picker here — doesn't require the "planning" permission.
    return db.query(ScheduleItem).order_by(ScheduleItem.order_index).all()


@router.put("/items/{item_id}/tasks", response_model=BudgetItemAdmin)
def set_item_tasks(
    item_id: str,
    payload: BudgetItemTaskLinksUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("budget")),
):
    item = db.get(BudgetItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Élément introuvable")
    tasks = (
        db.query(ScheduleItem).filter(ScheduleItem.id.in_(payload.schedule_item_ids)).all()
        if payload.schedule_item_ids
        else []
    )
    item.schedule_items = tasks
    db.commit()
    db.refresh(item)
    guests = db.query(Guest).all()
    return _serialize(item, guests)


@router.get("/summary", response_model=BudgetSummary)
def get_summary(db: Session = Depends(get_db), admin: Admin = Depends(require_permission("budget"))):
    settings_row = _get_or_create_settings(db)
    items = db.query(BudgetItem).all()
    total_activities = sum(i.price for i in items if i.category == BudgetCategory.activity)
    total_food = sum(i.price for i in items if i.category == BudgetCategory.food)
    total = total_activities + total_food
    remaining = (
        settings_row.budget_target - total if settings_row.budget_target is not None else None
    )
    return BudgetSummary(
        budget_target=settings_row.budget_target,
        total_activities=total_activities,
        total_food=total_food,
        total=total,
        remaining=remaining,
        items_count=len(items),
    )


@router.patch("/target", response_model=BudgetSummary)
def set_budget_target(
    payload: BudgetTargetUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("budget")),
):
    settings_row = _get_or_create_settings(db)
    settings_row.budget_target = payload.budget_target
    db.commit()
    return get_summary(db=db, admin=admin)
