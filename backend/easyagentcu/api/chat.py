from __future__ import annotations

import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from easyagentcu.schemas.models import AckRequest, SendMessageRequest, SendMessageResponse, StopTaskRequest
from easyagentcu.main import get_runtime, get_bus


router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/send", response_model=SendMessageResponse)
async def send_message(req: SendMessageRequest):
    runtime = get_runtime()
    task_id = await runtime.start_task(req.session_id, req.text)
    return SendMessageResponse(task_id=task_id)


@router.post("/stop")
async def stop_task(req: StopTaskRequest):
    runtime = get_runtime()
    await runtime.stop_task(req.task_id)
    return {"ok": True}


@router.post("/ack-user-action")
async def ack_user_action(req: AckRequest):
    runtime = get_runtime()
    await runtime.ack_user_action(req.task_id)
    return {"ok": True}


@router.get("/stream")
async def stream(session_id: str):
    bus = get_bus()

    async def event_gen():
        async for evt in bus.subscribe(session_id):
            payload = json.dumps(evt["data"], ensure_ascii=False)
            yield f"event: {evt['event']}\ndata: {payload}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")
