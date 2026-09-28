from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models import AdminRole, BudgetCategory, QuestionStatus, ScheduleItemType

# ---------- Auth ----------


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    requires_2fa_setup: bool = False
    challenge_token: str | None = None
    provisioning_uri: str | None = None
    access_token: str | None = None
    token_type: str = "bearer"


class Verify2FARequest(BaseModel):
    challenge_token: str
    code: str


class Confirm2FASetupRequest(BaseModel):
    challenge_token: str
    code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminMe(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    role: AdminRole
    permissions: list[str]
    photo_url: str | None
    totp_enabled: bool


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class Start2FAResetRequest(BaseModel):
    current_password: str


class Start2FAResetResponse(BaseModel):
    provisioning_uri: str


class Confirm2FAResetRequest(BaseModel):
    code: str


# ---------- Admin accounts (owner-managed) ----------


class AdminAccountCreate(BaseModel):
    username: str
    password: str
    permissions: list[str] = []
    guest_name: str


class AdminAccountUpdate(BaseModel):
    permissions: list[str] | None = None


class AdminAccountResetPassword(BaseModel):
    new_password: str


class AdminAccountPublic(BaseModel):
    id: str
    username: str
    role: AdminRole
    permissions: list[str]
    photo_url: str | None
    totp_enabled: bool
    guest_id: str | None
    guest_name: str | None
    created_at: datetime


# ---------- Guests ----------


class GuestPublic(BaseModel):
    """What every guest can see about every other guest."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    pseudo: str | None
    photo_url: str | None
    description: str | None
    bringing_item: str | None


class GuestSelf(BaseModel):
    """What a guest can see/edit about themselves via their access code."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    pseudo: str | None
    photo_url: str | None
    description: str | None
    email: str | None
    allergies: str | None
    diet: str | None
    intolerances: str | None
    dietary_comment: str | None
    bringing_item: str | None


class GuestSelfUpdate(BaseModel):
    pseudo: str | None = None
    email: str | None = None
    allergies: str | None = None
    diet: str | None = None
    intolerances: str | None = None
    dietary_comment: str | None = None
    bringing_item: str | None = None


class GuestAdmin(GuestSelf):
    access_code: str
    created_at: datetime


class GuestCreate(BaseModel):
    name: str
    pseudo: str | None = None
    description: str | None = None


class GuestUpdateAdmin(BaseModel):
    name: str | None = None
    pseudo: str | None = None
    description: str | None = None
    allergies: str | None = None
    diet: str | None = None
    intolerances: str | None = None
    dietary_comment: str | None = None
    bringing_item: str | None = None
    email: str | None = None


# ---------- Questions ----------


class QuestionCreate(BaseModel):
    text: str
    choice_1: str
    choice_2: str
    choice_3: str
    choice_4: str
    correct_index: int
    guest_access_code: str | None = None


class QuestionUpdateAdmin(BaseModel):
    text: str | None = None
    choice_1: str | None = None
    choice_2: str | None = None
    choice_3: str | None = None
    choice_4: str | None = None
    correct_index: int | None = None
    status: QuestionStatus | None = None
    time_limit_seconds: int | None = None
    order_index: int | None = None


class QuestionPublic(BaseModel):
    """Safe shape shown to guests browsing/proposing (no correct answer)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    text: str
    choice_1: str
    choice_2: str
    choice_3: str
    choice_4: str
    image_url: str | None
    status: QuestionStatus


class QuestionAdmin(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    guest_id: str | None
    text: str
    choice_1: str
    choice_2: str
    choice_3: str
    choice_4: str
    correct_index: int
    image_url: str | None
    status: QuestionStatus
    order_index: int
    time_limit_seconds: int
    created_at: datetime


# ---------- Messages ----------


class MessageCreate(BaseModel):
    author_name: str
    content: str | None = None
    guest_access_code: str | None = None


class MessagePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    author_name: str
    content: str | None
    photo_url: str | None
    created_at: datetime


# ---------- Settings ----------


class AppSettingsPublic(BaseModel):
    party_mode_active: bool
    party_location_name: str | None = None
    party_address: str | None = None
    party_date: str | None = None
    party_time: str | None = None
    gallery_url: str | None = None
    # Sourced from the GALLERY_PASSWORD env var, not from the DB row — see
    # the /settings endpoint, which fills this in manually.
    gallery_password: str | None = None


class PartyInfoUpdate(BaseModel):
    party_location_name: str | None = None
    party_address: str | None = None
    party_date: str | None = None
    party_time: str | None = None
    gallery_url: str | None = None


# ---------- Budget & lists ----------


class BudgetItemCreate(BaseModel):
    category: BudgetCategory
    name: str
    price: float = 0
    prep_time_minutes: int | None = None
    allergens: str | None = None
    notes: str | None = None


class BudgetItemUpdate(BaseModel):
    category: BudgetCategory | None = None
    name: str | None = None
    price: float | None = None
    prep_time_minutes: int | None = None
    allergens: str | None = None
    notes: str | None = None
    is_done: bool | None = None


class AllergyConflict(BaseModel):
    guest_id: str
    guest_name: str
    matched_allergen: str
    guest_allergy_text: str


class LinkedTask(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    type: ScheduleItemType
    duration_minutes: int
    # Computed HH:MM the block starts at, per the current day-start + order —
    # only filled in by the /budget/tasks picker endpoint, not stored.
    start_label: str | None = None


class BudgetItemAdmin(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    category: BudgetCategory
    name: str
    price: float
    prep_time_minutes: int | None
    allergens: str | None
    notes: str | None
    is_done: bool
    created_at: datetime
    conflicts: list[AllergyConflict] = []
    linked_tasks: list[LinkedTask] = []
    # Sum of every linked task's duration — the item's real total prep time
    # once it's tied to one or more planning blocks. Falls back to
    # prep_time_minutes on the frontend when no task is linked.
    linked_minutes: int = 0


class BudgetItemTaskLinksUpdate(BaseModel):
    schedule_item_ids: list[str]


class BudgetSummary(BaseModel):
    budget_target: float | None
    total_activities: float
    total_food: float
    total: float
    remaining: float | None
    items_count: int


class BudgetTargetUpdate(BaseModel):
    budget_target: float | None = None


# ---------- Day schedule ----------


class ScheduleItemCreate(BaseModel):
    type: ScheduleItemType
    title: str
    duration_minutes: int = 30
    fixed_start_time: str | None = None
    notes: str | None = None


class ScheduleItemUpdate(BaseModel):
    type: ScheduleItemType | None = None
    title: str | None = None
    duration_minutes: int | None = None
    fixed_start_time: str | None = None
    notes: str | None = None
    order_index: int | None = None


class ScheduleItemAdmin(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: ScheduleItemType
    title: str
    duration_minutes: int
    fixed_start_time: str | None
    notes: str | None
    order_index: int
    created_at: datetime


class DayStartUpdate(BaseModel):
    day_start_time: str


class DayScheduleSettings(BaseModel):
    day_start_time: str


# ---------- Quiz sessions & results ----------


class GameSessionSummary(BaseModel):
    id: str
    label: str
    started_at: datetime
    ended_at: datetime | None
    players_count: int
    answers_count: int
    top_score: int


class PlayerAnswerDetail(BaseModel):
    question_id: str
    question_text: str
    choices: list[str]
    correct_index: int
    answered: bool
    choice_index: int | None = None
    is_correct: bool = False
    points: int = 0
    response_time_ms: int | None = None


class PlayerResult(BaseModel):
    player_id: str
    nickname: str
    score: int
    email: str | None = None
    recap_emailed_at: datetime | None = None
    answers: list[PlayerAnswerDetail]


class PlayerEmailUpdate(BaseModel):
    email: str | None = None


class PlayerResendEmail(BaseModel):
    email: str | None = None


class GameSessionDetail(BaseModel):
    id: str
    label: str
    started_at: datetime
    ended_at: datetime | None
    players: list[PlayerResult]


# ---------- Fun stats / awards ----------


class AnswerHighlight(BaseModel):
    nickname: str
    question_text: str
    response_time_ms: int


class StreakHighlight(BaseModel):
    nickname: str
    streak: int


class PlayerHighlight(BaseModel):
    nickname: str


class SessionAwards(BaseModel):
    fastest_answer: AnswerHighlight | None = None
    slowest_answer: AnswerHighlight | None = None
    best_streak: StreakHighlight | None = None
    worst_streak: StreakHighlight | None = None
    most_consistent: PlayerHighlight | None = None
    most_unpredictable: PlayerHighlight | None = None


# ---------- Podium predictions ----------


class PredictionCreate(BaseModel):
    first_nickname: str
    second_nickname: str
    third_nickname: str


class PredictionResult(BaseModel):
    player_id: str
    predictor_nickname: str
    first_nickname: str
    second_nickname: str
    third_nickname: str
    correct_slots: int
