# EasyAgentCU 实现方案（v1）

> 目标：把 `记事本.md`、架构图、原型图里的“运行时行为”落地成可开发、可联调、可上线的一套具体实现。

## 1. 目标对齐与设计原则

### 1.1 必须满足的行为

1. 用户发送任务后，助手消息区**立即出现“屏幕画面窗口”**（先显示实时画面占位/流，再进入截图回放）。
2. 智能体执行过程中持续产出“进展文本”，默认折叠，仅显示最新一条；可展开为带时序竖线的列表；点击进展可跳转对应截图。
3. 屏幕窗口底部有进度条（节点 = 历史进展截图 + 最后一个“实时”节点），可拖动/点击切换。
4. 当进入“任务完成”或“需要用户操作”时，切换为“回答文本态”（不再显示进展+屏幕窗口）。
5. 若是“需要用户操作”，回答下方显示“我已经操作”按钮，点击自动发送“我已经操作”。
6. 鼠标点击采用“移动→截图校验→纠偏→再校验→点击”的鲁棒流程，并把鼠标坐标+鼠标高亮标注图一起给模型。

### 1.2 工程原则

- **前后端分层**：Web 聊天体验与 CUA 执行器解耦。
- **状态驱动 UI**：前端仅渲染后端事件流（SSE），不猜测状态。
- **可替换模型供应商**：统一 Agent 接口，支持 OpenAI CUA / Qwen-VL 计划器。
- **先可用后增强**：先做单任务串行 + 单会话，再扩展多会话并发。

---

## 2. 总体架构（对应架构图闭环）

```text
[Browser UI]
   |  POST /api/chat/send
   v
[FastAPI Gateway] --(enqueue task)--> [Agent Runtime]
   ^                                      |
   |<------- SSE /api/chat/stream --------|
                                          v
                                    [Computer Adapter]
                                          |
                                 (pyautogui/playwright/vnc)
                                          |
                                   [VM Desktop/Browser]
                                          |
                                 screenshot + cursor mark
                                          |
                                          v
                                     [Model Adapter]
                              (OpenAI CUA / Qwen Planner)
```

### 2.1 模块划分

- `backend/app.py`：FastAPI 入口（绑定 `0.0.0.0`）。
- `backend/api/chat.py`：发送消息、停止任务、SSE 订阅。
- `backend/agent/runtime.py`：任务状态机与 CUA 循环。
- `backend/agent/model_adapter.py`：模型适配层。
- `backend/computer/adapter.py`：电脑动作执行（click/type/scroll...）。
- `backend/computer/screenshot.py`：截图、鼠标标注、压缩。
- `backend/store/session_store.py`：会话与事件缓存（SQLite + 文件系统）。
- `frontend/app/...`：Next.js 页面与组件。

---

## 3. 后端实现细节（Python / FastAPI）

## 3.1 数据模型（核心）

```python
class ChatMessage:
    id: str
    role: Literal["user", "assistant"]
    kind: Literal["user_text", "assistant_progress", "assistant_answer"]
    text: str
    created_at: datetime

class ProgressStep:
    id: str
    task_id: str
    index: int
    text: str
    screenshot_id: str | None
    cursor_x: int | None
    cursor_y: int | None
    created_at: datetime

class ScreenshotFrame:
    id: str
    task_id: str
    step_id: str | None   # 实时帧可空
    path: str
    width: int
    height: int
    is_live: bool
    created_at: datetime

class TaskState:
    id: str
    session_id: str
    status: Literal[
      "queued", "running", "awaiting_user", "completed", "failed", "stopped"
    ]
    current_step_index: int
    live_frame_id: str | None
```

## 3.2 事件流协议（前端全部由此驱动）

SSE event types：

- `task.started`：收到用户消息后立即发，前端创建“助手窗口态消息”。
- `screen.live`：实时帧更新。
- `progress.append`：新增进展文本 + 对应截图元信息。
- `progress.update`：纠正/补充某条进展文本（可选）。
- `task.awaiting_user`：出现回答文本 + `show_ack_button=true`。
- `task.completed`：出现回答文本（最终答案）。
- `task.failed`：错误信息。
- `task.stopped`：用户手动停止。

## 3.3 Agent Runtime 状态机

```text
IDLE
  -> on user_message -> START_TASK
START_TASK
  -> emit task.started + initial live frame
  -> RUN_LOOP
RUN_LOOP
  -> plan next action (model)
  -> execute action (computer)
  -> capture screenshot + cursor metadata
  -> summarize progress
  -> emit progress.append
  -> if done -> COMPLETED
  -> if needs_user -> AWAITING_USER
AWAITING_USER
  -> emit task.awaiting_user(answer + ack button)
  -> wait for synthetic user message "我已经操作"
  -> RUN_LOOP
COMPLETED
  -> emit task.completed(answer)
STOPPED/FAILED -> terminal
```

## 3.4 CUA 循环实现（参考 openai-cua-sample-app 的可复用思想）

参考点（用于本项目实现）：

- 使用“`computer` 工具 + 截图回传”的循环模式。
- 把“执行动作”和“截图回传”封装到 `Computer` 抽象层。
- 每轮将模型建议动作执行后，立即回传 `computer_call_output`（含 screenshot）。
- 对浏览器环境可附带 `current_url`，并接入域名安全校验。

### 3.4.1 建议的统一 Action Schema

```json
{
  "type": "click|double_click|move|scroll|type|keypress|drag|wait",
  "args": {"x": 100, "y": 220, "button": "left"},
  "intent": "点击搜索框",
  "requires_verification": true
}
```

### 3.4.2 动作执行器（Computer Adapter）

- `PlaywrightComputer`：浏览器优先（推荐首发）。
- `DesktopComputer`：虚拟机桌面（pyautogui + mss）。

统一接口：

```python
class ComputerAdapter(Protocol):
    def screenshot(self) -> PIL.Image: ...
    def move(self, x:int, y:int) -> None: ...
    def click(self, x:int, y:int, button:str="left") -> None: ...
    def type(self, text:str) -> None: ...
    def scroll(self, x:int, y:int, scroll_x:int, scroll_y:int) -> None: ...
    def keypress(self, keys:list[str]) -> None: ...
    def get_cursor_position(self) -> tuple[int, int]: ...
    def get_current_url(self) -> str | None: ...
```

---

## 4. 鼠标点击鲁棒性（重点落地）

## 4.1 纠偏算法（必须实现）

输入：目标点 `(tx, ty)`、最大迭代 `N=4`、容差 `r=14px`

1. `move(tx, ty)`
2. 截图 + 获取当前鼠标 `(mx, my)`
3. 生成“带标注图”：圈住 `(mx,my)` + 箭头 + 文本“鼠标指针”
4. 发送给模型：
   - 当前任务意图
   - 原目标 `(tx, ty)`
   - 当前鼠标 `(mx, my)`
   - 标注图
   - 要求输出：`{"on_target": bool, "dx": int, "dy": int}`
5. 若 `on_target=true` 或 `distance((mx,my),(tx,ty)) <= r`：执行 click
6. 否则更新目标 `(tx, ty) = (mx+dx, my+dy)`，继续循环
7. 达到 `N` 仍失败：
   - 退化策略：不点击，产出“需要用户操作”回答（避免误点）

## 4.2 标注渲染实现

用 `Pillow` 绘制：

- 圆：`ellipse([mx-12,my-12,mx+12,my+12], outline="#ff3b30", width=4)`
- 箭头：从 `(mx-80,my-80)` 指向 `(mx,my)`
- 文案：箭头尾部绘制“鼠标指针”

同时把 `(mx,my)` 作为结构化字段入模，避免只靠视觉。

---

## 5. 模型适配策略（Qwen优先 + OpenAI兼容）

## 5.1 Adapter 设计

```python
class PlannerAdapter(Protocol):
    def next_action(self, context: PlannerContext) -> PlannerResult: ...
    def summarize_progress(self, context: ProgressContext) -> str: ...
    def final_answer(self, context: AnswerContext) -> AnswerResult: ...
```

## 5.2 两种实现

1. `OpenAICUAAdapter`：
   - 直接走 Responses API + computer tool（对标 sample app）。
   - 优势：工具协议成熟，动作质量高。
2. `QwenVisionPlannerAdapter`（默认）：
   - 用视觉模型看图 + JSON 结构化输出下一步动作。
   - 输出强约束 JSON（Pydantic 校验），无效则重试。

## 5.3 成本与可控性

- 低成本日常跑批：Qwen 适配器。
- 高难场景兜底：切换 OpenAI CUA。
- 配置：`MODEL_PROVIDER=qwen|openai` + `MODEL_NAME=...`

---

## 6. 前端实现细节（Next.js + shadcn/ui + prompt-kit）

## 6.1 组件映射（结合 prompt-kit）

可直接借鉴/复用：

- 聊天容器与自动吸底：`chat-container` + `scroll-button`
- 消息展示：`message`
- 输入框与回车提交：`prompt-input`
- 文件上传拖拽层：`file-upload`
- 可折叠步骤：`steps`（非常适配“进展文本”）
- 思考中状态：`thinking-bar`

## 6.2 关键自定义组件

- `AssistantRunCard`
  - `ProgressHeader`（折叠/展开、最新进展）
  - `ProgressTimeline`（竖线时序、可点击）
  - `ScreenWindow`
    - 顶部“窗口栏”
    - 中部图片（历史截图或实时流）
    - 底部 `ProgressScrubber`（节点+拖动）
- `AssistantAnswerCard`
  - 回答文本
  - 可选“我已经操作”按钮

## 6.3 前端状态模型

```ts
type AssistantMessageState =
  | { mode: "running"; steps: Step[]; selectedStepId?: string; liveFrame?: Frame }
  | { mode: "answer"; text: string; awaitingUser?: boolean }
```

联动规则：

- 点击步骤 -> `selectedStepId` 更新 -> 屏幕切到该步骤截图 -> 进度条游标同步。
- 拖动进度条到某节点 -> 反向高亮步骤列表对应项。
- 拖到末尾“实时”节点 -> 显示 live frame。

---

## 7. API 设计

## 7.1 REST

- `POST /api/chat/send`
  - body: `{ session_id, text, attachments[] }`
  - return: `{ task_id }`
- `POST /api/chat/stop`
  - body: `{ task_id }`
- `POST /api/chat/ack-user-action`
  - body: `{ task_id }`（后端等价转译为“我已经操作”）

## 7.2 SSE

- `GET /api/chat/stream?session_id=...`
- 服务端推送事件（见第 3.2）

---

## 8. 存储与文件组织

```text
runtime/
  sessions/{session_id}/
    messages.jsonl
    tasks/{task_id}/
      frames/
        0001.png
        0001_annotated.png
      steps.jsonl
      answer.md
```

- 原图 + 标注图都保留，便于回放与调试。
- `steps.jsonl` 每行包含 step 文本、截图 id、光标坐标、动作。

---

## 9. 安全与风控

- 域名 allowlist / blocklist。
- 敏感站点触发“人工确认模式”。
- 最大动作步数上限（如 80 步）与超时（如 8 分钟）。
- 高风险动作（提交、付款、删除）必须 `awaiting_user`。

---

## 10. 最小可用版本（MVP）里程碑

### M1（先跑通）

- FastAPI + Next.js 基础聊天。
- SSE 流式事件。
- Playwright Computer + 截图回传。
- 进展列表 + 屏幕窗口 + 进度条联动。

### M2（满足设计稿关键体验）

- 回答态与运行态切换。
- “我已经操作”按钮闭环。
- 鼠标鲁棒点击（移动校验纠偏）。

### M3（增强）

- 会话持久化。
- 故障恢复（任务可重放）。
- Qwen/OpenAI 双适配动态切换。

---

## 11. 运行与部署建议

- 后端：`uvicorn backend.app:app --host 0.0.0.0 --port 8000`
- 前端：`next dev -H 0.0.0.0 -p 3000`
- 反向代理：Nginx 统一对外端口，注意 SSE 的 `proxy_buffering off`。
- 在虚拟机中运行，宿主机浏览器访问 VM IP。

---

## 12. 与参考资料的关系说明

本方案重点吸收了以下参考思想并做了定制：

1. **openai-cua-sample-app**
   - `Computer` 抽象 + Agent 循环 + `computer_call_output` 回传模式。
   - 安全检查（safety checks）与 browser URL 辅助校验思路。
2. **prompt-kit**
   - 聊天输入、步骤折叠、消息组件、吸底滚动、文件上传等 UI 原语。
   - 用 `steps` 组件承载“进展时间线”最贴合原型。

以上参考只用于“实现思路与组件选型”，具体业务状态机与交互联动按你的原型图与记事本要求定制。
