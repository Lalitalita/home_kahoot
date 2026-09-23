import enum
import secrets
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


def gen_access_code() -> str:
    # Short, easy to type on a phone / put on a paper invite.
    return secrets.token_hex(4)


class AdminRole(str, enum.Enum):
    owner = "owner"
    staff = "staff"


# Every admin section that can be individually granted to a "staff" admin.
# The owner always has every one of these implicitly.
ADMIN_PERMISSION_SECTIONS = [
    "guests",
    "budget",
    "planning",
    "questions",
    "messages",
    "party",
    "results",
]


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    totp_secret: Mapped[str | None] = mapped_column(String, nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[AdminRole] = mapped_column(Enum(AdminRole), default=AdminRole.staff)
    # Comma-separated subset of ADMIN_PERMISSION_SECTIONS. Ignored for the
    # owner, who always has full access.
    permissions: Mapped[str] = mapped_column(Text, default="")
    # Staff admins are also invited guests — this links the two records.
    guest_id: Mapped[str | None] = mapped_column(
        ForeignKey("guests.id", ondelete="SET NULL"), nullable=True
    )
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def has_permission(self, section: str) -> bool:
        if self.role == AdminRole.owner:
            return True
        return section in (self.permissions or "").split(",")


class Guest(Base):
    __tablename__ = "guests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String)
    pseudo: Mapped[str | None] = mapped_column(String, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_code: Mapped[str] = mapped_column(
        String, unique=True, index=True, default=gen_access_code
    )

    # Filled in by the guest themselves via their personal link.
    allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    diet: Mapped[str | None] = mapped_column(Text, nullable=True)
    intolerances: Mapped[str | None] = mapped_column(Text, nullable=True)
    dietary_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    bringing_item: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    questions: Mapped[list["Question"]] = relationship(
        back_populates="proposed_by", cascade="all, delete-orphan"
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="guest", cascade="all, delete-orphan"
    )


class QuestionStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    guest_id: Mapped[str | None] = mapped_column(
        ForeignKey("guests.id", ondelete="SET NULL"), nullable=True
    )
    text: Mapped[str] = mapped_column(Text)
    choice_1: Mapped[str] = mapped_column(String)
    choice_2: Mapped[str] = mapped_column(String)
    choice_3: Mapped[str] = mapped_column(String)
    choice_4: Mapped[str] = mapped_column(String)
    correct_index: Mapped[int] = mapped_column(Integer)  # 0-3
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[QuestionStatus] = mapped_column(
        Enum(QuestionStatus), default=QuestionStatus.pending
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    time_limit_seconds: Mapped[int] = mapped_column(Integer, default=20)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    proposed_by: Mapped["Guest | None"] = relationship(back_populates="questions")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    guest_id: Mapped[str | None] = mapped_column(
        ForeignKey("guests.id", ondelete="SET NULL"), nullable=True
    )
    author_name: Mapped[str] = mapped_column(String)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    guest: Mapped["Guest | None"] = relationship(back_populates="messages")


class AppSettings(Base):
    """Singleton row (id always 'singleton') holding global toggles."""

    __tablename__ = "app_settings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default="singleton")
    party_mode_active: Mapped[bool] = mapped_column(Boolean, default=False)
    budget_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    # "HH:MM" — what time the day's schedule starts counting from.
    day_start_time: Mapped[str] = mapped_column(String, default="10:00")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class ScheduleItemType(str, enum.Enum):
    activity = "activity"
    meal_prep = "meal_prep"
    break_ = "break"


class ScheduleItem(Base):
    """One block of the day's run-of-show: an activity, a meal-prep task,
    or a break. Ordered by order_index; the actual clock time each block
    starts at is computed on the frontend from AppSettings.day_start_time
    plus the cumulative duration of everything before it, unless the item
    pins its own fixed_start_time (e.g. "guests arrive at 18:00")."""

    __tablename__ = "schedule_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    type: Mapped[ScheduleItemType] = mapped_column(Enum(ScheduleItemType))
    title: Mapped[str] = mapped_column(String)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    # "HH:MM" or None — reanchors the running clock at this block.
    fixed_start_time: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BudgetCategory(str, enum.Enum):
    activity = "activity"
    food = "food"


class BudgetItem(Base):
    """A planned expense: an activity or a food item. Food items can be
    tagged with the allergens they contain so the admin can cross-check
    them against every guest's stated allergies/intolerances."""

    __tablename__ = "budget_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    category: Mapped[BudgetCategory] = mapped_column(Enum(BudgetCategory))
    name: Mapped[str] = mapped_column(String)
    price: Mapped[float] = mapped_column(Float, default=0)
    prep_time_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Comma/semicolon-separated free-text tags, e.g. "arachides, gluten".
    allergens: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class GameSession(Base):
    """One run of the live quiz — the admin starts a new one each time
    they hit "Réinitialiser"/"Démarrer", so test runs before the party
    and the real thing each get their own separate results."""

    __tablename__ = "game_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    label: Mapped[str] = mapped_column(String, default="Session")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Comma-separated, in the order they were actually shown — lets recaps
    # list every question a player *could* have answered, including ones
    # they skipped, without depending on questions still existing/unedited.
    question_ids: Mapped[str | None] = mapped_column(Text, nullable=True)


class GamePlayer(Base):
    """A record of someone who joined the live quiz. Kept for the final
    scoreboard/export even after the party is over."""

    __tablename__ = "game_players"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    session_id: Mapped[str | None] = mapped_column(
        ForeignKey("game_sessions.id", ondelete="CASCADE"), nullable=True
    )
    nickname: Mapped[str] = mapped_column(String)
    guest_id: Mapped[str | None] = mapped_column(
        ForeignKey("guests.id", ondelete="SET NULL"), nullable=True
    )
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    recap_emailed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    score: Mapped[int] = mapped_column(Integer, default=0)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class GameAnswer(Base):
    __tablename__ = "game_answers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    player_id: Mapped[str] = mapped_column(ForeignKey("game_players.id", ondelete="CASCADE"))
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    choice_index: Mapped[int] = mapped_column(Integer)
    is_correct: Mapped[bool] = mapped_column(Boolean)
    points: Mapped[int] = mapped_column(Integer, default=0)
    response_time_ms: Mapped[int] = mapped_column(Integer, default=0)
    answered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
