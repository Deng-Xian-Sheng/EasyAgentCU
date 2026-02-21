# EasyAgentCU

EasyAgentCU，一个简单的 ComputerUse（电脑使用）智能体。当前仓库已经提供可运行的后端与 Web 交互界面，包含：

- 聊天发送/停止
- SSE 实时事件流
- 运行态消息卡（进展折叠、时间线点击、屏幕窗口、实时点）
- 回答态消息卡（支持“我已经操作”按钮闭环）
- 鼠标鲁棒点击模块（移动-截图标注-纠偏-点击）

## 目录

- `backend/`：FastAPI 服务、Agent Runtime、SSE、鲁棒点击逻辑。
- `web/`：前端界面（静态页面 + JS 交互）。
- `记事本.md`：需求说明。
- `EasyAgentCU实现方案.md`：设计文档。

## 本地运行

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./run.sh
```

启动后访问：

- `http://127.0.0.1:8000`
- 或在虚拟机场景下通过 `http://<VM_IP>:8000`

## 测试

```bash
cd backend
source .venv/bin/activate
pytest -q
```
