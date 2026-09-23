import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import Admin, Guest, Question

router = APIRouter(prefix="/api/admin/export", tags=["export"])


def _csv_response(rows: list[list[str]], header: list[str], filename: str) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/guests.csv")
def export_guests(db: Session = Depends(get_db), admin: Admin = Depends(require_permission("guests"))):
    guests = db.query(Guest).order_by(Guest.name).all()
    rows = [
        [g.name, g.pseudo or "", g.description or "", g.bringing_item or "", g.access_code]
        for g in guests
    ]
    return _csv_response(
        rows, ["Nom", "Pseudo", "Description", "Amène", "Code d'accès"], "invites.csv"
    )


@router.get("/allergies.csv")
def export_allergies(db: Session = Depends(get_db), admin: Admin = Depends(require_permission("guests"))):
    guests = db.query(Guest).order_by(Guest.name).all()
    rows = [
        [g.name, g.allergies or "", g.diet or "", g.intolerances or "", g.dietary_comment or ""]
        for g in guests
    ]
    return _csv_response(
        rows,
        ["Nom", "Allergies", "Régime", "Intolérances", "Commentaire"],
        "regimes_alimentaires.csv",
    )


@router.get("/questions.csv")
def export_questions(db: Session = Depends(get_db), admin: Admin = Depends(require_permission("questions"))):
    questions = db.query(Question).order_by(Question.created_at).all()
    rows = [
        [
            q.text,
            q.choice_1,
            q.choice_2,
            q.choice_3,
            q.choice_4,
            ["1", "2", "3", "4"][q.correct_index],
            q.status.value,
            q.proposed_by.name if q.proposed_by else "Admin",
        ]
        for q in questions
    ]
    return _csv_response(
        rows,
        [
            "Question",
            "Réponse 1",
            "Réponse 2",
            "Réponse 3",
            "Réponse 4",
            "Bonne réponse (n°)",
            "Statut",
            "Proposée par",
        ],
        "questions_quiz.csv",
    )
