import asyncio
import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import require_permission
from app.email_sender import send_recap_email
from app.models import Admin, GameAnswer, GamePlayer, GameSession
from app.pdf import build_player_recap_pdf, build_session_recap_pdf
from app.recap import build_player_result, get_session_top3
from app.schemas import (
    GameSessionDetail,
    GameSessionSummary,
    PlayerEmailUpdate,
    PlayerResendEmail,
    PlayerResult,
)

router = APIRouter(prefix="/api", tags=["results"])


def _get_session_detail(db: Session, session_id: str) -> GameSessionDetail:
    session_row = db.get(GameSession, session_id)
    if session_row is None:
        raise HTTPException(status_code=404, detail="Session introuvable")
    players = (
        db.query(GamePlayer)
        .filter(GamePlayer.session_id == session_id)
        .order_by(GamePlayer.score.desc())
        .all()
    )
    return GameSessionDetail(
        id=session_row.id,
        label=session_row.label,
        started_at=session_row.started_at,
        ended_at=session_row.ended_at,
        players=[build_player_result(db, p) for p in players],
    )


# ---------- Admin: sessions list & detail ----------


@router.get("/admin/sessions", response_model=list[GameSessionSummary])
def list_sessions(db: Session = Depends(get_db), admin: Admin = Depends(require_permission("results"))):
    sessions = db.query(GameSession).order_by(GameSession.started_at.desc()).all()
    result = []
    for s in sessions:
        players = db.query(GamePlayer).filter(GamePlayer.session_id == s.id).all()
        answers_count = (
            db.query(GameAnswer)
            .join(GamePlayer, GameAnswer.player_id == GamePlayer.id)
            .filter(GamePlayer.session_id == s.id)
            .count()
        )
        top_score = max((p.score for p in players), default=0)
        result.append(
            GameSessionSummary(
                id=s.id,
                label=s.label,
                started_at=s.started_at,
                ended_at=s.ended_at,
                players_count=len(players),
                answers_count=answers_count,
                top_score=top_score,
            )
        )
    return result


@router.get("/admin/sessions/{session_id}", response_model=GameSessionDetail)
def get_session(
    session_id: str, db: Session = Depends(get_db), admin: Admin = Depends(require_permission("results"))
):
    return _get_session_detail(db, session_id)


@router.delete("/admin/sessions/{session_id}")
def delete_session(
    session_id: str, db: Session = Depends(get_db), admin: Admin = Depends(require_permission("results"))
):
    session_row = db.get(GameSession, session_id)
    if session_row is None:
        raise HTTPException(status_code=404, detail="Session introuvable")
    db.delete(session_row)
    db.commit()
    return {"ok": True}


@router.get("/admin/sessions/{session_id}/export.csv")
def export_session_csv(
    session_id: str, db: Session = Depends(get_db), admin: Admin = Depends(require_permission("results"))
):
    detail = _get_session_detail(db, session_id)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["Pseudo", "Score final", "Question", "Réponse donnée", "Bonne réponse", "Correct", "Points"]
    )
    for player in detail.players:
        if not player.answers:
            writer.writerow([player.nickname, player.score, "", "", "", "", ""])
        for a in player.answers:
            if not a.answered:
                given = "(pas de réponse)"
            elif a.choice_index is not None and 0 <= a.choice_index < len(a.choices):
                given = a.choices[a.choice_index]
            else:
                given = ""
            correct = a.choices[a.correct_index]
            writer.writerow(
                [
                    player.nickname,
                    player.score,
                    a.question_text,
                    given,
                    correct,
                    "oui" if a.is_correct else "non",
                    a.points,
                ]
            )
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="resultats_{session_id[:8]}.csv"'},
    )


@router.get("/admin/sessions/{session_id}/export.pdf")
def export_session_pdf(
    session_id: str, db: Session = Depends(get_db), admin: Admin = Depends(require_permission("results"))
):
    detail = _get_session_detail(db, session_id)
    pdf_bytes = build_session_recap_pdf(detail)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="resultats_{session_id[:8]}.pdf"'},
    )


# ---------- Admin: manage a player's email + resend the recap ----------


@router.patch("/admin/players/{player_id}/email", response_model=PlayerResult)
def update_player_email(
    player_id: str,
    payload: PlayerEmailUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("results")),
):
    player = db.get(GamePlayer, player_id)
    if player is None:
        raise HTTPException(status_code=404, detail="Joueur introuvable")
    cleaned = payload.email.strip() if payload.email else ""
    player.email = cleaned or None
    db.commit()
    db.refresh(player)
    return build_player_result(db, player)


@router.post("/admin/players/{player_id}/resend-email")
async def resend_player_email(
    player_id: str,
    payload: PlayerResendEmail,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_permission("results")),
):
    player = db.get(GamePlayer, player_id)
    if player is None:
        raise HTTPException(status_code=404, detail="Joueur introuvable")

    target = (payload.email or player.email or "").strip()
    if not target:
        raise HTTPException(status_code=400, detail="Aucune adresse email pour ce joueur")

    result = build_player_result(db, player)
    top3 = get_session_top3(db, player.session_id) if player.session_id else []
    pdf_bytes = build_player_recap_pdf(result, party_title=get_settings().app_name, top3=top3)
    sent = await asyncio.to_thread(
        send_recap_email, target, player.nickname, pdf_bytes, get_settings().app_name
    )
    if not sent:
        raise HTTPException(
            status_code=502, detail="Échec de l'envoi — vérifie la configuration SMTP dans .env"
        )

    player.recap_emailed_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "sent_to": target}


# ---------- Player: personal recap ----------


@router.get("/players/{player_id}/recap.pdf")
def player_recap_pdf(player_id: str, db: Session = Depends(get_db)):
    player = db.get(GamePlayer, player_id)
    if player is None:
        raise HTTPException(status_code=404, detail="Joueur introuvable")
    result = build_player_result(db, player)
    top3 = get_session_top3(db, player.session_id) if player.session_id else []
    pdf_bytes = build_player_recap_pdf(result, party_title=get_settings().app_name, top3=top3)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="mon-recap-{player.nickname}.pdf"'},
    )
