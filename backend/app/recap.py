"""Builds a player's question-by-question recap from the database.

Shared by the results admin router (viewing/exporting past sessions) and
the quiz engine (emailing a recap right when a session finishes), so it
lives outside both rather than being duplicated or creating a router ->
engine import.
"""

import statistics

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import GameAnswer, GamePlayer, GameSession, Question
from app.schemas import (
    AnswerHighlight,
    PlayerAnswerDetail,
    PlayerHighlight,
    PlayerResult,
    SessionAwards,
    StreakHighlight,
)


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


def compute_session_awards(db: Session, session_id: str) -> SessionAwards:
    """Fun end-of-session highlights: fastest/slowest answer, longest
    correct/wrong streaks, most consistent and most unpredictable player.
    Returns an all-None SessionAwards if there's not enough data (empty
    session, or a single answer) to make any of these meaningful."""
    session_row = db.get(GameSession, session_id)
    if session_row is None or not session_row.question_ids:
        return SessionAwards()
    question_order = [qid for qid in session_row.question_ids.split(",") if qid]
    order_index = {qid: i for i, qid in enumerate(question_order)}

    players = db.query(GamePlayer).filter(GamePlayer.session_id == session_id).all()
    player_by_id = {p.id: p for p in players}
    if not player_by_id:
        return SessionAwards()

    answers = db.query(GameAnswer).filter(GameAnswer.player_id.in_(player_by_id.keys())).all()
    if not answers:
        return SessionAwards()

    questions = {
        q.id: q for q in db.query(Question).filter(Question.id.in_(question_order)).all()
    }

    def highlight(a: GameAnswer) -> AnswerHighlight:
        player = player_by_id.get(a.player_id)
        question = questions.get(a.question_id)
        return AnswerHighlight(
            nickname=player.nickname if player else "?",
            question_text=question.text if question else "?",
            response_time_ms=a.response_time_ms,
        )

    fastest = min(answers, key=lambda a: a.response_time_ms)
    slowest = max(answers, key=lambda a: a.response_time_ms)

    by_player: dict[str, list[GameAnswer]] = {}
    for a in answers:
        by_player.setdefault(a.player_id, []).append(a)
    for plist in by_player.values():
        plist.sort(key=lambda a: order_index.get(a.question_id, 0))

    best_streak_player, best_streak_len = None, 0
    worst_streak_player, worst_streak_len = None, 0
    consistency: list[tuple[str, float]] = []

    for pid, plist in by_player.items():
        cur = mx = 0
        for a in plist:
            cur = cur + 1 if a.is_correct else 0
            mx = max(mx, cur)
        if mx > best_streak_len:
            best_streak_len, best_streak_player = mx, pid

        cur = mx = 0
        for a in plist:
            cur = cur + 1 if not a.is_correct else 0
            mx = max(mx, cur)
        if mx > worst_streak_len:
            worst_streak_len, worst_streak_player = mx, pid

        if len(plist) >= 2:
            consistency.append((pid, statistics.pstdev(a.points for a in plist)))

    most_consistent_id = min(consistency, key=lambda t: t[1])[0] if consistency else None
    most_unpredictable_id = max(consistency, key=lambda t: t[1])[0] if consistency else None

    return SessionAwards(
        fastest_answer=highlight(fastest),
        slowest_answer=highlight(slowest),
        best_streak=(
            StreakHighlight(nickname=player_by_id[best_streak_player].nickname, streak=best_streak_len)
            if best_streak_player and best_streak_len >= 2
            else None
        ),
        worst_streak=(
            StreakHighlight(nickname=player_by_id[worst_streak_player].nickname, streak=worst_streak_len)
            if worst_streak_player and worst_streak_len >= 2
            else None
        ),
        most_consistent=(
            PlayerHighlight(nickname=player_by_id[most_consistent_id].nickname)
            if most_consistent_id
            else None
        ),
        most_unpredictable=(
            PlayerHighlight(nickname=player_by_id[most_unpredictable_id].nickname)
            if most_unpredictable_id and most_unpredictable_id != most_consistent_id
            else None
        ),
    )
