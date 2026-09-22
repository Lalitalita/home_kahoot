from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Admin, Guest, Question, QuestionStatus
from app.schemas import QuestionAdmin, QuestionCreate, QuestionPublic, QuestionUpdateAdmin
from app.uploads import save_upload

router = APIRouter(prefix="/api", tags=["questions"])


# ---------- Guest-facing ----------


@router.post("/questions", response_model=QuestionAdmin)
def propose_question(payload: QuestionCreate, db: Session = Depends(get_db)):
    guest_id = None
    if payload.guest_access_code:
        guest = (
            db.query(Guest).filter(Guest.access_code == payload.guest_access_code).first()
        )
        if guest is None:
            raise HTTPException(status_code=404, detail="Invité introuvable")
        guest_id = guest.id

    if not (0 <= payload.correct_index <= 3):
        raise HTTPException(status_code=400, detail="Index de réponse invalide")

    question = Question(
        guest_id=guest_id,
        text=payload.text,
        choice_1=payload.choice_1,
        choice_2=payload.choice_2,
        choice_3=payload.choice_3,
        choice_4=payload.choice_4,
        correct_index=payload.correct_index,
        status=QuestionStatus.pending,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.get("/questions/mine/{access_code}", response_model=list[QuestionAdmin])
def my_questions(access_code: str, db: Session = Depends(get_db)):
    guest = db.query(Guest).filter(Guest.access_code == access_code).first()
    if guest is None:
        raise HTTPException(status_code=404, detail="Invité introuvable")
    return (
        db.query(Question)
        .filter(Question.guest_id == guest.id)
        .order_by(Question.created_at.desc())
        .all()
    )


@router.post("/questions/{question_id}/image", response_model=QuestionAdmin)
async def upload_question_image(
    question_id: str, access_code: str, file: UploadFile, db: Session = Depends(get_db)
):
    question = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question introuvable")
    guest = db.query(Guest).filter(Guest.access_code == access_code).first()
    if guest is None or question.guest_id != guest.id:
        raise HTTPException(status_code=403, detail="Non autorisé")

    question.image_url = await save_upload(file, "questions")
    db.commit()
    db.refresh(question)
    return question


# ---------- Admin ----------


@router.get("/admin/questions", response_model=list[QuestionAdmin])
def list_questions_admin(
    db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)
):
    return db.query(Question).order_by(Question.order_index, Question.created_at).all()


@router.post("/admin/questions", response_model=QuestionAdmin)
def create_question_admin(
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if not (0 <= payload.correct_index <= 3):
        raise HTTPException(status_code=400, detail="Index de réponse invalide")
    question = Question(
        text=payload.text,
        choice_1=payload.choice_1,
        choice_2=payload.choice_2,
        choice_3=payload.choice_3,
        choice_4=payload.choice_4,
        correct_index=payload.correct_index,
        status=QuestionStatus.accepted,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.patch("/admin/questions/{question_id}", response_model=QuestionAdmin)
def update_question_admin(
    question_id: str,
    payload: QuestionUpdateAdmin,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    question = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question introuvable")
    data = payload.model_dump(exclude_unset=True)
    if "correct_index" in data and data["correct_index"] is not None:
        if not (0 <= data["correct_index"] <= 3):
            raise HTTPException(status_code=400, detail="Index de réponse invalide")
    for field, value in data.items():
        setattr(question, field, value)
    db.commit()
    db.refresh(question)
    return question


@router.post("/admin/questions/{question_id}/image", response_model=QuestionAdmin)
async def upload_question_image_admin(
    question_id: str,
    file: UploadFile,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    question = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question introuvable")
    question.image_url = await save_upload(file, "questions")
    db.commit()
    db.refresh(question)
    return question


@router.delete("/admin/questions/{question_id}")
def delete_question_admin(
    question_id: str, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)
):
    question = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question introuvable")
    db.delete(question)
    db.commit()
    return {"ok": True}
