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
from app.email_sender import send_recap_email, send_session_recap_email
from app.models import GameAnswer, GamePlayer, GameSession, Question, QuestionStatus
from app.pdf import build_player_recap_pdf, build_session_recap_pdf
from app.recap import build_player_result, get_session_top3
from app.schemas import GameSessionDetail
from app.ws_manager import manager

settings = get_settings()
logger = logging.getLogger(__name__)

# How long the reveal (correct answer + bar chart) and the leaderboard stay
# on screen before the game moves on by itself.
REVEAL_DISPLAY_SECONDS = 5
LEADERBOARD_DISPLAY_SECONDS = 4


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
    photo_url: str | None = None
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
    # Whichever timer is currently queued to move the game forward by
    # itself: the per-question countdown, or the reveal/leaderboard
    # display timers. Only one is ever pending at a time.
    pending_task: asyncio.Task | None = None
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
            self._cancel_pending()
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
        self,
        nickname: str,
        guest_id: str | None,
        email: str | None = None,
        photo_url: str | None = None,
    ) -> str:
        async with self._lock:
            player_id = str(uuid.uuid4())
            self.state.players[player_id] = PlayerState(
                id=player_id,
                nickname=nickname,
                guest_id=guest_id,
                email=email,
                photo_url=photo_url,
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
        question -> reveal, leaderboard -> next question or finished. Also
        called by the pending timers below, so the game plays itself once
        started — admin clicks are only needed to skip ahead early."""
        just_finished = False
        async with self._lock:
            self._cancel_pending()

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
        elif self.state.phase == Phase.reveal:
            self._schedule_auto_advance(REVEAL_DISPLAY_SECONDS)
        elif self.state.phase == Phase.leaderboard:
            self._schedule_auto_advance(LEADERBOARD_DISPLAY_SECONDS)

        if just_finished:
            asyncio.create_task(self._send_recap_emails())
            asyncio.create_task(self._send_admin_recap_email())

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
        """Background task: mail each player who has an email on file their
        PDF recap. Reads the DB fresh (rather than the in-memory state) so
        it picks up any email the admin added/edited right up to the end of
        the session, and only ever reaches players who actually joined
        *this* session. Runs after the finished-state broadcast so it never
        delays the TV/controller UI, and never raises into the caller."""
        if not self.state.session_id:
            return
        with SessionLocal() as db:
            players = (
                db.query(GamePlayer)
                .filter(
                    GamePlayer.session_id == self.state.session_id,
                    GamePlayer.email.isnot(None),
                    GamePlayer.email != "",
                )
                .all()
            )
            player_ids = [p.id for p in players]

        for player_id in player_ids:
            try:
                with SessionLocal() as db:
                    db_player = db.get(GamePlayer, player_id)
                    if db_player is None or not db_player.email:
                        continue
                    result = build_player_result(db, db_player)
                    top3 = get_session_top3(db, self.state.session_id)
                    pdf_bytes = build_player_recap_pdf(result, party_title=settings.app_name, top3=top3)
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
                logger.exception("Échec de l'envoi du récap au joueur %s", player_id)

    async def _send_admin_recap_email(self) -> None:
        """Background task: mail the organizer their own copy of the full
        session — every player, every answer, the podium — separate from
        each player's personal recap. Never raises into the caller."""
        if not self.state.session_id:
            return
        target = settings.admin_recap_email_or_default
        if not target:
            return
        try:
            with SessionLocal() as db:
                session_row = db.get(GameSession, self.state.session_id)
                if session_row is None:
                    return
                players = (
                    db.query(GamePlayer)
                    .filter(GamePlayer.session_id == self.state.session_id)
                    .order_by(GamePlayer.score.desc())
                    .all()
                )
                detail = GameSessionDetail(
                    id=session_row.id,
                    label=session_row.label,
                    started_at=session_row.started_at,
                    ended_at=session_row.ended_at,
                    players=[build_player_result(db, p) for p in players],
                )
            pdf_bytes = build_session_recap_pdf(detail, party_title=settings.app_name)
            await asyncio.to_thread(
                send_session_recap_email, target, detail.label, len(detail.players), pdf_bytes, settings.app_name
            )
        except Exception:
            logger.exception("Échec de l'envoi du récap complet de session à l'organisateur")

    def _cancel_pending(self) -> None:
        task = self.state.pending_task
        if task is not None and not task.done():
            task.cancel()
        self.state.pending_task = None

    def _schedule_auto_reveal(self) -> None:
        question = self.current_question()
        if question is None:
            return
        duration = question.time_limit_seconds

        async def _auto():
            try:
                await asyncio.sleep(duration + 0.5)
            except asyncio.CancelledError:
                return
            self.state.pending_task = None
            async with self._lock:
                if self.state.phase != Phase.question:
                    return
                self._reveal()
            await self._broadcast_state()
            self._schedule_auto_advance(REVEAL_DISPLAY_SECONDS)

        self.state.pending_task = asyncio.create_task(_auto())

    def _schedule_auto_advance(self, delay: float) -> None:
        """Queue a plain advance() after `delay` seconds — used to move on
        from reveal to leaderboard, and from leaderboard to the next
        question, without the admin having to click anything."""
        self._cancel_pending()

        async def _auto():
            try:
                await asyncio.sleep(delay)
            except asyncio.CancelledError:
                return
            # Clear the reference *before* calling advance(): advance()
            # itself calls _cancel_pending(), and since this task IS
            # self.state.pending_task, cancelling it while it's still
            # running (mid-await inside advance()) would abort advance()
            # partway through. Clearing first makes that cancel a no-op.
            self.state.pending_task = None
            await self.advance()

        self.state.pending_task = asyncio.create_task(_auto())

    async def reveal_now(self) -> None:
        """Force the transition into the reveal phase immediately (used
        right after the answer that makes everyone_answered true).

        Kept separate from submit_answer() so the caller can deliver that
        player's own answer_result over their websocket *before* calling
        this — otherwise the reveal-phase broadcast this triggers can reach
        that same player first, leaving their client showing "you didn't
        answer" for the instant before their actual result arrives."""
        async with self._lock:
            if self.state.phase != Phase.question:
                return
            self._cancel_pending()
            self._reveal()
        await self._broadcast_state()
        self._schedule_auto_advance(REVEAL_DISPLAY_SECONDS)

    async def submit_answer(self, player_id: str, choice_index: int) -> tuple[dict, bool] | None:
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

        result = {"is_correct": is_correct, "points": points, "total_score": player.score}
        return result, everyone_answered

    def leaderboard(self) -> list[dict]:
        ranked = sorted(self.state.players.values(), key=lambda p: p.score, reverse=True)
        return [
            {
                "nickname": p.nickname,
                "score": p.score,
                "player_id": p.id,
                "photo_url": p.photo_url,
            }
            for p in ranked
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
