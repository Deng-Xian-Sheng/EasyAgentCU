'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PromptInput, PromptInputActions, PromptInputTextarea } from '@/components/prompt-kit/prompt-input'
import { ChatContainerContent, ChatContainerRoot } from '@/components/prompt-kit/chat-container'
import { Steps, StepsContent, StepsItem, StepsTrigger } from '@/components/prompt-kit/steps'

type Step = { id: string; text: string; dataUrl: string }

type RunState = {
  mode: 'run' | 'answer'
  collapsed: boolean
  steps: Step[]
  liveFrame?: string
  selected: number
  answerText?: string
  awaitingUser?: boolean
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://127.0.0.1:8000'

const MOCK_CHATS = [
  '提取热搜新闻', '打开百度热搜', '百度热搜新闻提取', '求职助手任务', '项目设计补全建议', '书写错误检查',
  'deepinV25重启网络服务', 'Computer Use Guide', 'CUA 计算机使用智能体', '城市与创造力探索', '项目设计建议', '视频变速编辑方法', '开源代理模式项目', '模型选择与基准对比', '除夕夜CEO问候'
]

export function ChatApp() {
  const [input, setInput] = useState('')
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([])
  const [runState, setRunState] = useState<RunState | null>(null)
  const sessionIdRef = useRef('default-session')

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/chat/stream?session_id=${encodeURIComponent(sessionIdRef.current)}`)
    es.addEventListener('task.started', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setCurrentTaskId(data.task_id)
      setRunState({ mode: 'run', collapsed: true, steps: [], selected: 0 })
      setMessages((m) => [...m, { role: 'assistant', text: '' }])
    })
    es.addEventListener('screen.live', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setRunState((s) => (s ? { ...s, liveFrame: data.frame.data_url, selected: s.steps.length } : s))
    })
    es.addEventListener('progress.append', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      const step: Step = { id: data.step.id, text: data.step.text, dataUrl: data.step.screenshot.data_url }
      setRunState((s) => (s ? { ...s, mode: 'run', steps: [...s.steps, step], selected: s.steps.length + 1 } : s))
    })
    es.addEventListener('task.awaiting_user', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setRunState((s) => (s ? { ...s, mode: 'answer', answerText: data.text, awaitingUser: !!data.show_ack_button } : s))
    })
    es.addEventListener('task.completed', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setRunState((s) => (s ? { ...s, mode: 'answer', answerText: data.text, awaitingUser: false } : s))
    })
    es.addEventListener('task.failed', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setRunState((s) => (s ? { ...s, mode: 'answer', answerText: `失败：${data.text}`, awaitingUser: false } : s))
    })
    return () => es.close()
  }, [])

  const onSend = async () => {
    const text = input.trim()
    if (!text) return
    setMessages((m) => [...m, { role: 'user', text }])
    setInput('')
    await fetch(`${API_BASE}/api/chat/send`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sessionIdRef.current, text }),
    })
  }

  const onStop = async () => {
    if (!currentTaskId) return
    await fetch(`${API_BASE}/api/chat/stop`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task_id: currentTaskId }),
    })
  }

  const onAck = async () => {
    if (!currentTaskId) return
    await fetch(`${API_BASE}/api/chat/ack-user-action`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task_id: currentTaskId }),
    })
  }

  return (
    <div className="grid h-screen grid-cols-[270px_1fr] bg-[#1f1f23] text-[#ebedf0]">
      <aside className="border-r border-white/10 p-4">
        <div className="mb-5 text-xl font-semibold">EasyAgentCU</div>
        <div className="mb-2 text-sm text-white/50">你的聊天</div>
        <div className="space-y-1 overflow-y-auto pr-1 text-sm">
          {MOCK_CHATS.map((chat) => <div key={chat} className="rounded px-2 py-1 hover:bg-white/5">{chat}</div>)}
        </div>
      </aside>

      <main className="relative flex h-screen flex-col">
        <ChatContainerRoot className="flex-1 px-8 pt-4 pb-40">
          <ChatContainerContent className="space-y-4">
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === 'user' ? 'ml-auto max-w-[58%] rounded-2xl bg-[#3a3f4a] px-4 py-2' : 'mr-auto max-w-[74%] rounded-2xl bg-[#2a2d35] px-4 py-2'}>
                {m.role === 'user' ? m.text : <RunPanel runState={runState} onAck={onAck} setRunState={setRunState} />}
              </div>
            ))}
          </ChatContainerContent>
        </ChatContainerRoot>

        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-[#1f1f23] px-8 py-4">
          <PromptInput value={input} onValueChange={setInput} onSubmit={onSend}>
            <PromptInputTextarea placeholder="描述任务" className="text-base" />
            <PromptInputActions className="justify-end">
              <Button onClick={onSend}>发送</Button>
              <Button variant="secondary" onClick={onStop}>停止</Button>
            </PromptInputActions>
          </PromptInput>
        </div>
      </main>
    </div>
  )
}

function RunPanel({ runState, onAck, setRunState }: { runState: RunState | null; onAck: () => Promise<void>; setRunState: React.Dispatch<React.SetStateAction<RunState | null>> }) {
  if (!runState) return <div className="text-white/80">正在思考</div>

  if (runState.mode === 'answer') {
    return (
      <div className="space-y-3">
        <div className="whitespace-pre-wrap leading-7">{runState.answerText}</div>
        {runState.awaitingUser ? <Button size="sm" onClick={onAck}>我已经操作</Button> : null}
      </div>
    )
  }

  const selectedFrame = runState.selected === runState.steps.length
    ? runState.liveFrame
    : runState.steps[runState.selected]?.dataUrl ?? runState.liveFrame

  return (
    <div className="w-[min(860px,70vw)] rounded-2xl border border-white/15 bg-[#252a33] p-3">
      <Steps defaultOpen={!runState.collapsed} onOpenChange={(v) => setRunState((s) => (s ? { ...s, collapsed: !v } : s))}>
        <StepsTrigger className="px-1 font-medium">
          {runState.collapsed ? (runState.steps.at(-1)?.text ?? '正在思考') : '进展列表'}
        </StepsTrigger>
        <StepsContent>
          {runState.steps.map((step, idx) => (
            <StepsItem key={step.id} className={idx === runState.selected ? 'bg-white/10' : ''} onClick={() => setRunState((s) => (s ? { ...s, selected: idx } : s))}>
              {idx + 1}. {step.text}
            </StepsItem>
          ))}
        </StepsContent>
      </Steps>

      <div className="mt-2 rounded-xl border border-white/15 p-2">
        {selectedFrame ? <img src={selectedFrame} alt="screen" className="w-full rounded-lg" /> : null}
        <div className="mt-2 flex items-center gap-2">
          {runState.steps.map((step, idx) => (
            <button key={step.id} className={`size-3 rounded-full ${idx === runState.selected ? 'bg-white' : 'bg-white/35'}`} onClick={() => setRunState((s) => (s ? { ...s, selected: idx } : s))} />
          ))}
          <button className={`size-3 rounded-full ${runState.selected === runState.steps.length ? 'bg-white' : 'bg-white/35'}`} onClick={() => setRunState((s) => (s ? { ...s, selected: s.steps.length } : s))} />
          <span className="text-xs text-white/70">直播</span>
        </div>
      </div>
    </div>
  )
}
