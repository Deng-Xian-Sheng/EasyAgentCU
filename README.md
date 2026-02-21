# EasyAgentCU

EasyAgentCU，一个简单的 ComputerUse（电脑使用）智能体。

## 技术栈

- 后端：Python + FastAPI（SSE 事件流）
- 前端：Next.js + Tailwind CSS + Radix UI（Collapsible）+ shadcn 风格基础组件

## 已实现功能

- 聊天发送/停止
- SSE 实时事件流
- 运行态消息卡（进展折叠、时间线点击、屏幕窗口、实时点）
- 回答态消息卡（支持“我已经操作”按钮闭环）
- 鼠标鲁棒点击模块（移动-截图标注-纠偏-点击）

## 目录

- `backend/`：FastAPI 服务、Agent Runtime、SSE、鲁棒点击逻辑。
- `frontend/`：Next.js 前端（不再使用传统单文件 HTML/JS/CSS）。
- `记事本.md`：需求说明。
- `EasyAgentCU实现方案.md`：设计文档。

## 运行

### 1) 启动后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./run.sh
```

后端默认：`http://127.0.0.1:8000`

### 2) 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认：`http://127.0.0.1:3000`

可选环境变量（前端）：

```bash
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
```

## 测试

```bash
cd backend
source .venv/bin/activate
pytest -q
```
