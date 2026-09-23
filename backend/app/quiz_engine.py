import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.email_sender import send_recap_email
from app.models import GameAnswer, GamePlayer, GameSession, Question, QuestionStatus
from app.pdf import build_player_recap_pdf
from app.recap import build_player_result
from app.ws_manager import manager

settings = get_settings()
logger = logging.getLogger(__name__)


class Phase(str, Enum):
    lobby = "lobby"
    question = "question"
    reveal = "reveal"
    leaderboard = "leaderboard"
    finished = "finished"


@dataclass
class PlayerState:
    id: str
    nickname: str
    guest_id: str | None = None
    email: str | None = None
    score: int = 0
    streak: int = 0
    answered_this_round: bool = False


@dataclass
class GameState:
    session_id: str | None = None
    phase: Phase = Phase.lobby
    questions: list[Question] = field(default_factory=list)
    question_index: int = -1
    question_started_at: float | None = None
    players: dict[str, PlayerState] = field(default_factory=dict)
    # choice_index counts for the currently shown question, for the live bar chart
    answer_counts: dict[int, int] = field(default_factory=lambda: {0: 0, 1: 0, 2: 0, 3: 0})
    auto_reveal_task: asyncio.Task | None = None
    # Ids of questions actually shown so far this session, in order — lets
    # recaps include ones a player skipped without assuming every accepted
    # question loaded at reset time was necessarily reached.
    presented_question_ids: list[str] = field(default_factory=list)


class QuizEngine:
    def __init__(self) -> None:
        self.state = GameState()
        self._lock = asyncio.Lock()

    # ---------- lifecycle ----------

    def current_question(self) -> Question | None:
        if 0 <= self.state.question_index < len(self.state.questions):
            return self.state.questions[self.state.question_index]
        return None

    async def reset(self, label: str | None = None) -> None:
        async with self._lock:
            self._cancel_auto_reveal()
            with SessionLocal() as db:
                # Commit the new session row first: committing expires every
                # object already loaded in this Session, so the questions
                # must be queried afterwards or they'd be unusable once this
                # `with` block closes and detaches them.
                session_row = GameSession(
                    label=label or f"Session du {datetime.now().strftime('%d/%m %H:%M')}"
                )
                db.add(session_row)
                db.commit()
                db.refresh(session_row)

                questions = (
                    db.execute(
                        select(Question)
                        .where(Question.status == QuestionStatus.accepted)
                        .order_by(Question.order_index, Question.created_at)
                    )
                    .scalars()
                    .all()
                )
            self.state = GameState(session_id=session_row.id, questions=list(questions))
        await self._broadcast_state()

    async def add_player(
        self, nickname: str, guest_id: str | None, email: str | None = None
    ) -> str:
        async with self._lock:
            player_id = str(uuid.uuid4())
            self.state.players[player_id] = PlayerState(
                id=player_id, nickname=nickname, guest_id=guest_id, email=email
            )
            with SessionLocal() as db:
                db.add(
                    GamePlayer(
                        id=player_id,
                        session_id=self.state.session_id,
                        nickname=nickname,
                        guest_id=guest_id,
                        email=email,
                        score=0,
                    )
                )
                db.commit()
        await self._broadcast_state()
        return player_id

    async def remove_player(self, player_id: str) -> None:
        async with self._lock:
            self.state.players.pop(player_id, None)
        await self._broadcast_state()

    async def start(self) -> None:
        async with self._lock:
            if not self.state.questions:
                with SessionLocal() as db:
                    questions = (
                        db.execute(
                            select(Question)
                            .where(Question.status == QuestionStatus.accepted)
                            .order_by(Question.order_index, Question.created_at)
                        )
                        .scalars()
                        .all()
                    )
                self.state.questions = list(questions)
            self.state.question_index = -1
        await self.advance()

    async def advance(self) -> None:
        """Move the game forward one step: lobby/reveal -> next question,
        question -> reveal, leaderboard -> next question or finished."""
        just_finished = False
        async with self._lock:
            self._cancel_auto_reveal()

            if self.state.phase in (Phase.lobby, Phase.leaderboard):
                self.state.question_index += 1
                if self.state.question_index >= len(self.state.questions):
                    self.state.phase = Phase.finished
                    self._mark_session_ended()
                    just_finished = True
                else:
                    self._begin_question()
            elif self.state.phase == Phase.question:
                self._reveal()
            elif self.state.phase == Phase.reveal:
                self.state.phase = Phase.leaderboard
            elif self.state.phase == Phase.finished:
                pass

        await self._broadcast_state()

        if self.state.phase == Phase.question:
            self._schedule_auto_reveal()
        if just_finished:
            asyncio.create_task(self._send_recap_emails())

    def _begin_question(self) -> None:
        self.state.phase = Phase.question
        self.state.question_started_at = time.time()
        self.state.answer_counts = {0: 0, 1: 0, 2: 0, 3: 0}
        for p in self.state.players.values():
            p.answered_this_round = False

        question = self.current_question()
        if question is not None:
            self.state.presented_question_ids.append(question.id)
            self._persist_presented_questions()

    def _persist_presented_questions(self) -> None:
        if not self.state.session_id:
            return
        with SessionLocal() as db:
            session_row = db.get(GameSession, self.state.session_id)
            if session_row is not None:
                session_row.question_ids = ",".join(self.state.presented_question_ids)
                db.commit()

    def _reveal(self) -> None:
        self.state.phase = Phase.reveal

    def _mark_session_ended(self) -> None:
        if not self.state.session_id:
            return
        with SessionLocal() as db:
            session_row = db.get(GameSession, self.state.session_id)
            if session_row is not None:
                session_row.ended_at = datetime.utcnow()
                db.commit()

    async def _send_recap_emails(self) -> None:
        """Background task: mail each player who gave an email their PDF
        recap. Runs after the finished-state broadcast so it never delays
        the TV/controller UI, and never raises into the caller."""
        players_with_email = [p for p in self.state.players.values() if p.email]
        for player in players_with_email:
            try:
                with SessionLocal() as db:
                    db_player = db.get(GamePlayer, player.id)
                    if db_player is None or not db_player.email:
                        continue
                    result = build_player_result(db, db_player)
                    pdf_bytes = build_player_recap_pdf(result, party_title=settings.app_name)
                    sent = await asyncio.to_thread(
                        send_recap_email,
                        db_player.email,
                        db_player.nickname,
                        pdf_bytes,
                        settings.app_name,
                    )
                    if sent:
                        db_player.recap_emailed_at = datetime.utcnow()
                        db.commit()
            except Exception:
                logger.exception("Échec de l'envoi du récap à %s", player.email)

    def _cancel_auto_reveal(self) -> None:
        task = self.state.auto_reveal_task
        if task is not None and not task.done():
            task.cancel()
        self.state.auto_reveal_task = None

    def _schedule_auto_reveal(self) -> None:
        question = self.current_question()
        if question is None:
            return
        duration = question.time_limit_seconds

        async def _auto():
            try:
                await asyncio.sleep(duration + 0.5)
                async with self._lock:
                    if self.state.phase != Phase.question:
                        return
                    self._reveal()
                await self._broadcast_state()
            except asyncio.CancelledError:
                pass

        self.state.auto_reveal_task = asyncio.create_task(_auto())

    async def submit_answer(self, player_id: str, choice_index: int) -> dict | None:
        async with self._lock:
            if self.state.phase != Phase.question:
                return None
            player = self.state.players.get(player_id)
            question = self.current_question()
            if player is None or question is None or player.answered_this_round:
                return None
            if choice_index not in (0, 1, 2, 3):
                return None

            player.answered_this_round = True
            elapsed = time.time() - (self.state.question_started_at or time.time())
            duration = question.time_limit_seconds
            is_correct = choice_index == question.correct_index

            points = 0
            if is_correct:
                ratio = max(0.0, 1 - (elapsed / duration) / 2) if duration > 0 else 1.0
                points = int(
                    settings.min_points_for_correct_answer
                    + (settings.max_points_per_question - settings.min_points_for_correct_answer)
                    * ratio
                )
                player.streak += 1
            else:
                player.streak = 0

            player.score += points
            self.state.answer_counts[choice_index] = self.state.answer_counts.get(
                choice_index, 0
            ) + 1

            with SessionLocal() as db:
                db.add(
                    GameAnswer(
                        player_id=player.id,
                        question_id=question.id,
                        choice_index=choice_index,
                        is_correct=is_correct,
                        points=points,
                        response_time_ms=int(elapsed * 1000),
                    )
                )
                db_player = db.get(GamePlayer, player.id)
                if db_player is not None:
                    db_player.score = player.score
                db.commit()

            everyone_answered = all(p.answered_this_round for p in self.state.players.values())

        await self._broadcast_state()
        if everyone_answered:
            async with self._lock:
                if self.state.phase == Phase.question:
                    self._cancel_auto_reveal()
                    self._reveal()
            await self._broadcast_state()

        return {"is_correct": is_correct, "points": points, "total_score": player.score}

    def leaderboard(self) -> list[dict]:
        ranked = sorted(self.state.players.values(), key=lambda p: p.score, reverse=True)
        return [
            {"nickname": p.nickname, "score": p.score, "player_id": p.id} for p in ranked
        ]

    def public_state(self) -> dict:
        question = self.current_question()
        payload = {
            "type": "state",
            "phase": self.state.phase.value,
            "question_index": self.state.question_index,
            "total_questions": len(self.state.questions),
            "players_count": len(self.state.players),
            "leaderboard": self.leaderboard()[:10],
        }
        if question is not None and self.state.phase in (Phase.question, Phase.reveal):
            payload["question"] = {
                "id": question.id,
                "text": question.text,
                "choices": [
                    question.choice_1,
                    question.choice_2,
                    question.choice_3,
                    question.choice_4,
                ],
                "image_url": question.image_url,
                "time_limit_seconds": question.time_limit_seconds,
                "started_at": self.state.question_started_at,
            }
        if self.state.phase == Phase.reveal and question is not None:
            payload["correct_index"] = question.correct_index
            payload["answer_counts"] = self.state.answer_counts
        if self.state.phase == Phase.finished:
            payload["top3"] = self.leaderboard()[:3]
        return payload

    async def _broadcast_state(self) -> None:
        await manager.broadcast(self.public_state())


engine = QuizEngine()
