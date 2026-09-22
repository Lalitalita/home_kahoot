import asyncio
import json

from fastapi import WebSocket


class ConnectionManager:
    """Keeps track of every socket connected to the live quiz: the big TV
    screen(s), each guest's phone controller, and the admin control panel.
    Sending is best-effort — a dead socket is just dropped."""

    def __init__(self) -> None:
        self.screens: set[WebSocket] = set()
        # player_id -> websocket
        self.players: dict[str, WebSocket] = {}
        self.admins: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect_screen(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self.screens.add(ws)

    async def connect_admin(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self.admins.add(ws)

    async def connect_player(self, ws: WebSocket, player_id: str) -> None:
        await ws.accept()
        async with self._lock:
            self.players[player_id] = ws

    async def disconnect_screen(self, ws: WebSocket) -> None:
        async with self._lock:
            self.screens.discard(ws)

    async def disconnect_admin(self, ws: WebSocket) -> None:
        async with self._lock:
            self.admins.discard(ws)

    async def disconnect_player(self, player_id: str) -> None:
        async with self._lock:
            self.players.pop(player_id, None)

    @staticmethod
    async def _send(ws: WebSocket, message: dict) -> bool:
        try:
            await ws.send_text(json.dumps(message))
            return True
        except Exception:
            return False

    async def send_to_player(self, player_id: str, message: dict) -> None:
        ws = self.players.get(player_id)
        if ws is not None:
            await self._send(ws, message)

    async def broadcast(self, message: dict) -> None:
        """Send to every connected screen, player and admin."""
        dead_screens = []
        dead_admins = []
        dead_players = []

        for ws in list(self.screens):
            if not await self._send(ws, message):
                dead_screens.append(ws)
        for ws in list(self.admins):
            if not await self._send(ws, message):
                dead_admins.append(ws)
        for pid, ws in list(self.players.items()):
            if not await self._send(ws, message):
                dead_players.append(pid)

        async with self._lock:
            for ws in dead_screens:
                self.screens.discard(ws)
            for ws in dead_admins:
                self.admins.discard(ws)
            for pid in dead_players:
                self.players.pop(pid, None)

    async def broadcast_to_screens_and_admins(self, message: dict) -> None:
        for ws in list(self.screens) + list(self.admins):
            await self._send(ws, message)


manager = ConnectionManager()
