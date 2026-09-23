import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import Base, SessionLocal, engine as db_engine, sync_missing_columns
from app.models import Admin, AdminRole
from app.routers import (
    accounts,
    auth,
    budget,
    export,
    guests,
    messages,
    questions,
    quiz_ws,
    results,
    schedule,
    settings as settings_router,
)
from app.security import hash_password

settings = get_settings()

# Must exist before StaticFiles mounts it below.
os.makedirs(settings.upload_dir, exist_ok=True)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=db_engine)
    sync_missing_columns()

    with SessionLocal() as db:
        # Backfill: admins created before multi-account support had no
        # role column at all — treat them as the owner, matching the full
        # access they already had, so upgrading never locks anyone out.
        needs_backfill = db.query(Admin).filter(Admin.role.is_(None)).all()
        for admin in needs_backfill:
            admin.role = AdminRole.owner
            admin.permissions = admin.permissions or ""
        if needs_backfill:
            db.commit()

        existing = db.query(Admin).filter(Admin.username == settings.admin_username).first()
        if existing is None:
            admin = Admin(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_bootstrap_password),
                role=AdminRole.owner,
            )
            db.add(admin)
            db.commit()


app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(guests.router)
app.include_router(questions.router)
app.include_router(messages.router)
app.include_router(settings_router.router)
app.include_router(budget.router)
app.include_router(schedule.router)
app.include_router(results.router)
app.include_router(export.router)
app.include_router(quiz_ws.router)
app.include_router(quiz_ws.control_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
