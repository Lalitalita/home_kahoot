import enum
import secrets
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
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


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    totp_secret: Mapped[str | None] = mapped_column(String, nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class GamePlayer(Base):
    """A record of someone who joined the live quiz. Kept for the final
    scoreboard/export even after the party is over."""

    __tablename__ = "game_players"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    nickname: Mapped[str] = mapped_column(String)
    guest_id: Mapped[str | None] = mapped_column(
        ForeignKey("guests.id", ondelete="SET NULL"), nullable=True
    )
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
