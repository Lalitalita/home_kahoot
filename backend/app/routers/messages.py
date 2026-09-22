from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Admin, Guest, Message
from app.schemas import MessageCreate, MessagePublic
from app.uploads import save_upload

router = APIRouter(prefix="/api", tags=["messages"])


@router.get("/messages", response_model=list[MessagePublic])
def list_messages(db: Session = Depends(get_db)):
    return db.query(Message).order_by(Message.created_at.desc()).all()


@router.post("/messages", response_model=MessagePublic)
def create_message(payload: MessageCreate, db: Session = Depends(get_db)):
    guest_id = None
    if payload.guest_access_code:
        guest = (
            db.query(Guest).filter(Guest.access_code == payload.guest_access_code).first()
        )
        if guest is not None:
            guest_id = guest.id

    if not payload.content:
        raise HTTPException(status_code=400, detail="Le message ne peut pas être vide")

    message = Message(guest_id=guest_id, author_name=payload.author_name, content=payload.content)
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.post("/messages/{message_id}/photo", response_model=MessagePublic)
async def upload_message_photo(
    message_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    message = db.get(Message, message_id)
    if message is None:
        raise HTTPException(status_code=404, detail="Message introuvable")
    message.photo_url = await save_upload(file, "messages")
    db.commit()
    db.refresh(message)
    return message


@router.post("/messages/photo", response_model=MessagePublic)
async def create_message_with_photo(
    author_name: str = Form(...),
    file: UploadFile = File(...),
    guest_access_code: str | None = Form(None),
    content: str | None = Form(None),
    db: Session = Depends(get_db),
):
    guest_id = None
    if guest_access_code:
        guest = db.query(Guest).filter(Guest.access_code == guest_access_code).first()
        if guest is not None:
            guest_id = guest.id

    photo_url = await save_upload(file, "messages")
    message = Message(
        guest_id=guest_id, author_name=author_name, content=content, photo_url=photo_url
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.delete("/admin/messages/{message_id}")
def delete_message_admin(
    message_id: str, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)
):
    message = db.get(Message, message_id)
    if message is None:
        raise HTTPException(status_code=404, detail="Message introuvable")
    db.delete(message)
    db.commit()
    return {"ok": True}
