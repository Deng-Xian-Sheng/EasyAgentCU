from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


TaskStatus = Literal["queued", "running", "awaiting_user", "completed", "failed", "stopped"]
MessageKind = Literal["user_text", "assistant_progress", "assistant_answer"]


class ChatMessage(BaseModel):
    id: str
    session_id: str
    role: Literal["user", "assistant"]
    kind: MessageKind
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ProgressStep(BaseModel):
    id: str
    task_id: str
    index: int
    text: str
    screenshot_id: Optional[str] = None
    cursor_x: Optional[int] = None
    cursor_y: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ScreenshotFrame(BaseModel):
    id: str
    task_id: str
    step_id: Optional[str] = None
    data_url: str
    width: int
    height: int
    is_live: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TaskState(BaseModel):
    id: str
    session_id: str
    status: TaskStatus = "queued"
    current_step_index: int = 0
    live_frame_id: Optional[str] = None


class SendMessageRequest(BaseModel):
    session_id: str
    text: str


class SendMessageResponse(BaseModel):
    task_id: str


class StopTaskRequest(BaseModel):
    task_id: str


class AckRequest(BaseModel):
    task_id: str
