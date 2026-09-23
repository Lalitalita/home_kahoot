"""Builds a player's question-by-question recap from the database.

Shared by the results admin router (viewing/exporting past sessions) and
the quiz engine (emailing a recap right when a session finishes), so it
lives outside both rather than being duplicated or creating a router ->
engine import.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import GameAnswer, GamePlayer, GameSession, Question
from app.schemas import PlayerAnswerDetail, PlayerResult


def build_player_result(db: Session, player: GamePlayer) -> PlayerResult:
    # Every question actually shown during the session, in order — not just
    # the ones this player answered, so skipped questions show up too.
    question_ids: list[str] = []
    if player.session_id:
        session_row = db.get(GameSession, player.session_id)
        if session_row is not None and session_row.question_ids:
            question_ids = [qid for qid in session_row.question_ids.split(",") if qid]

    questions_by_id: dict[str, Question] = {}
    if question_ids:
        rows = db.execute(select(Question).where(Question.id.in_(question_ids))).scalars().all()
        questions_by_id = {q.id: q for q in rows}

    given_by_question: dict[str, GameAnswer] = {
        a.question_id: a
        for a in db.query(GameAnswer).filter(GameAnswer.player_id == player.id).all()
    }

    answers: list[PlayerAnswerDetail] = []
    for qid in question_ids:
        question = questions_by_id.get(qid)
        if question is None:
            continue  # question was deleted since the session ran
        given = given_by_question.get(qid)
        answers.append(
            PlayerAnswerDetail(
                question_id=question.id,
                question_text=question.text,
                choices=[question.choice_1, question.choice_2, question.choice_3, question.choice_4],
                correct_index=question.correct_index,
                answered=given is not None,
                choice_index=given.choice_index if given else None,
                is_correct=given.is_correct if given else False,
                points=given.points if given else 0,
                response_time_ms=given.response_time_ms if given else None,
            )
        )

    return PlayerResult(
        player_id=player.id,
        nickname=player.nickname,
        score=player.score,
        email=player.email,
        recap_emailed_at=player.recap_emailed_at,
        answers=answers,
    )


def get_session_top3(db: Session, session_id: str, limit: int = 3) -> list[PlayerResult]:
    """Name + score only for the session's top players — enough for the
    podium on each player's own recap, without computing every one of
    their full question-by-question breakdowns like build_player_result
    does (which the podium doesn't need)."""
    top_players = (
        db.query(GamePlayer)
        .filter(GamePlayer.session_id == session_id)
        .order_by(GamePlayer.score.desc())
        .limit(limit)
        .all()
    )
    return [
        PlayerResult(player_id=p.id, nickname=p.nickname, score=p.score, answers=[])
        for p in top_players
    ]
