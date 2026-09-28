from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import Admin, GamePlayer, Prediction
from app.quiz_engine import Phase, engine
from app.schemas import PredictionCreate, PredictionResult

router = APIRouter(prefix="/api", tags=["predictions"])


@router.post("/predictions")
def submit_prediction(player_id: str, payload: PredictionCreate, db: Session = Depends(get_db)):
    if engine.state.phase != Phase.lobby:
        raise HTTPException(
            status_code=400, detail="Les pronostics ne sont plus possibles, le quiz a commencé."
        )
    player = db.get(GamePlayer, player_id)
    if player is None or player.session_id != engine.state.session_id:
        raise HTTPException(status_code=404, detail="Joueur introuvable pour cette session")

    existing = (
        db.query(Prediction)
        .filter(Prediction.session_id == player.session_id, Prediction.player_id == player_id)
        .first()
    )
    if existing is not None:
        existing.first_nickname = payload.first_nickname
        existing.second_nickname = payload.second_nickname
        existing.third_nickname = payload.third_nickname
    else:
        db.add(
            Prediction(
                session_id=player.session_id,
                player_id=player_id,
                first_nickname=payload.first_nickname,
                second_nickname=payload.second_nickname,
                third_nickname=payload.third_nickname,
            )
        )
    db.commit()
    return {"ok": True}


@router.get("/admin/sessions/{session_id}/predictions", response_model=list[PredictionResult])
def list_predictions(
    session_id: str, db: Session = Depends(get_db), admin: Admin = Depends(require_permission("results"))
):
    top3 = (
        db.query(GamePlayer)
        .filter(GamePlayer.session_id == session_id)
        .order_by(GamePlayer.score.desc())
        .limit(3)
        .all()
    )
    actual = [p.nickname for p in top3] + [None, None, None]
    predictions = db.query(Prediction).filter(Prediction.session_id == session_id).all()

    results = []
    for pred in predictions:
        player = db.get(GamePlayer, pred.player_id)
        correct_slots = sum(
            [
                pred.first_nickname == actual[0],
                pred.second_nickname == actual[1],
                pred.third_nickname == actual[2],
            ]
        )
        results.append(
            PredictionResult(
                player_id=pred.player_id,
                predictor_nickname=player.nickname if player else "?",
                first_nickname=pred.first_nickname,
                second_nickname=pred.second_nickname,
                third_nickname=pred.third_nickname,
                correct_slots=correct_slots,
            )
        )
    return sorted(results, key=lambda r: r.correct_slots, reverse=True)
