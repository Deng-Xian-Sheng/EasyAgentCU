from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any, AsyncGenerator


class SessionEventBus:
    def __init__(self) -> None:
        self._subscribers: dict[str, list[asyncio.Queue[dict[str, Any]]]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def publish(self, session_id: str, event: dict[str, Any]) -> None:
        async with self._lock:
            queues = list(self._subscribers.get(session_id, []))
        for q in queues:
            await q.put(event)

    async def subscribe(self, session_id: str) -> AsyncGenerator[dict[str, Any], None]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=200)
        async with self._lock:
            self._subscribers[session_id].append(q)
        try:
            while True:
                event = await q.get()
                yield event
        finally:
            async with self._lock:
                if session_id in self._subscribers and q in self._subscribers[session_id]:
                    self._subscribers[session_id].remove(q)
