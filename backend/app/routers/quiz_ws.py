import json

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import Admin, Guest
from app.quiz_engine import engine
from app.ws_manager import manager

router = APIRouter()

# ---------- WebSocket endpoints ----------


@router.websocket("/ws/screen")
async def ws_screen(websocket: WebSocket):
    await manager.connect_screen(websocket)
    try:
        await websocket.send_text(json.dumps(engine.public_state()))
        while True:
            # The TV screen never sends anything meaningful; just keep the
            # connection alive and detect disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect_screen(websocket)


@router.websocket("/ws/admin")
async def ws_admin(websocket: WebSocket):
    await manager.connect_admin(websocket)
    try:
        await websocket.send_text(json.dumps(engine.public_state()))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect_admin(websocket)


@router.websocket("/ws/player")
async def ws_player(
    websocket: WebSocket,
    nickname: str = Query(...),
    guest_code: str | None = Query(default=None),
    player_id: str | None = Query(default=None),
):
    nickname = nickname.strip()[:30]
    if not nickname:
        await websocket.close(code=4001)
        return

    # Email is never entered by the player — it's set ahead of time by the
    # admin on the guest's record (kept a surprise), and only sourced here.
    db: Session = next(get_db())
    guest_id = None
    email = None
    photo_url = None
    if guest_code:
        guest = db.query(Guest).filter(Guest.access_code == guest_code).first()
        if guest is not None:
            guest_id = guest.id
            email = guest.email
            photo_url = guest.photo_url
    db.close()

    if player_id and player_id in engine.state.players:
        pid = player_id
    else:
        pid = await engine.add_player(nickname, guest_id, email, photo_url)

    await manager.connect_player(websocket, pid)
    try:
        await websocket.send_text(json.dumps({"type": "joined", "player_id": pid}))
        await websocket.send_text(json.dumps(engine.public_state()))
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if data.get("type") == "answer":
                choice_index = data.get("choice_index")
                if isinstance(choice_index, int):
                    result = await engine.submit_answer(pid, choice_index)
                    if result is not None:
                        await websocket.send_text(
                            json.dumps({"type": "answer_result", **result})
                        )
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect_player(pid)


# ---------- Admin REST control ----------

control_router = APIRouter(prefix="/api/admin/quiz", tags=["quiz-control"])


@control_router.get("/state")
def get_state(admin: Admin = Depends(require_permission("party"))):
    return engine.public_state()


class ResetGameRequest(BaseModel):
    label: str | None = None


@control_router.post("/reset")
async def reset_game(
    payload: ResetGameRequest | None = None, admin: Admin = Depends(require_permission("party"))
):
    await engine.reset(label=payload.label if payload else None)
    return engine.public_state()


@control_router.post("/start")
async def start_game(admin: Admin = Depends(require_permission("party"))):
    await engine.start()
    return engine.public_state()


@control_router.post("/advance")
async def advance_game(admin: Admin = Depends(require_permission("party"))):
    await engine.advance()
    return engine.public_state()
