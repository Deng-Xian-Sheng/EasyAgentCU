from __future__ import annotations

import asyncio
import base64
from io import BytesIO
from uuid import uuid4
from PIL import Image

from easyagentcu.computer.adapter import MockComputer
from easyagentcu.computer.robust_click import robust_click
from easyagentcu.schemas.models import TaskState
from easyagentcu.store.session_store import SessionEventBus


class AgentRuntime:
    def __init__(self, bus: SessionEventBus) -> None:
        self.bus = bus
        self.tasks: dict[str, TaskState] = {}
        self.stop_flags: dict[str, asyncio.Event] = {}
        self.ack_queues: dict[str, asyncio.Queue[None]] = {}

    @staticmethod
    def _img_to_data_url(img: Image.Image) -> str:
        buf = BytesIO()
        img.save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

    async def start_task(self, session_id: str, text: str) -> str:
        task_id = str(uuid4())
        state = TaskState(id=task_id, session_id=session_id, status="queued")
        self.tasks[task_id] = state
        self.stop_flags[task_id] = asyncio.Event()
        self.ack_queues[task_id] = asyncio.Queue(maxsize=1)
        asyncio.create_task(self._run_task(state, text))
        return task_id

    async def stop_task(self, task_id: str) -> None:
        if task_id in self.stop_flags:
            self.stop_flags[task_id].set()

    async def ack_user_action(self, task_id: str) -> None:
        q = self.ack_queues.get(task_id)
        if q:
            await q.put(None)

    async def _emit(self, session_id: str, event: str, data: dict) -> None:
        await self.bus.publish(session_id, {"event": event, "data": data})

    async def _run_task(self, state: TaskState, text: str) -> None:
        session_id = state.session_id
        state.status = "running"
        computer = MockComputer()

        await self._emit(session_id, "task.started", {"task_id": state.id, "user_text": text})

        live = self._img_to_data_url(computer.screenshot())
        await self._emit(session_id, "screen.live", {"task_id": state.id, "frame": {"id": str(uuid4()), "is_live": True, "data_url": live}})

        plans = [
            "正在打开网页并定位任务入口",
            "正在读取页面结构并锁定输入区域",
            "正在执行点击和输入操作",
            "正在核对结果并准备总结",
        ]

        for i, step in enumerate(plans, 1):
            if self.stop_flags[state.id].is_set():
                state.status = "stopped"
                await self._emit(session_id, "task.stopped", {"task_id": state.id})
                return

            if i == 3:
                rc = robust_click(computer, 320, 225)
                frame = rc.annotated_data_url
                detail = f"{step}（鲁棒点击尝试 {rc.attempts} 次，点击={'成功' if rc.clicked else '失败'}）"
            else:
                computer.move(180 + i * 35, 140 + i * 25)
                frame = self._img_to_data_url(computer.screenshot())
                detail = step

            await self._emit(
                session_id,
                "progress.append",
                {
                    "task_id": state.id,
                    "step": {
                        "id": str(uuid4()),
                        "index": i,
                        "text": detail,
                        "screenshot": {"id": str(uuid4()), "is_live": False, "data_url": frame},
                    },
                },
            )
            await asyncio.sleep(0.35)

        state.status = "awaiting_user"
        await self._emit(
            session_id,
            "task.awaiting_user",
            {
                "task_id": state.id,
                "text": "我已经完成自动操作。请确认页面是否符合预期，如需继续请点击“我已经操作”。",
                "show_ack_button": True,
            },
        )

        try:
            await asyncio.wait_for(self.ack_queues[state.id].get(), timeout=300)
        except asyncio.TimeoutError:
            state.status = "failed"
            await self._emit(session_id, "task.failed", {"task_id": state.id, "text": "等待用户确认超时。"})
            return

        state.status = "completed"
        await self._emit(
            session_id,
            "task.completed",
            {
                "task_id": state.id,
                "text": "收到“我已经操作”。任务已继续并完成；如需新任务可直接输入。",
            },
        )
