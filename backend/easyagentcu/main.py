from __future__ import annotations

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from easyagentcu.store.session_store import SessionEventBus
from easyagentcu.agent.runtime import AgentRuntime

bus = SessionEventBus()
runtime = AgentRuntime(bus)


def get_bus() -> SessionEventBus:
    return bus


def get_runtime() -> AgentRuntime:
    return runtime


app = FastAPI(title="EasyAgentCU")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from easyagentcu.api.chat import router as chat_router  # noqa: E402

app.include_router(chat_router)


@app.get("/health")
async def health():
    return {"ok": True}


web_dir = Path(__file__).resolve().parents[2] / "web"
app.mount("/", StaticFiles(directory=str(web_dir), html=True), name="web")
