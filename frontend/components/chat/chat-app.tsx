'use client'

import * as Collapsible from '@radix-ui/react-collapsible'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

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

export function ChatApp() {
  const [input, setInput] = useState('')
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Array<{ role: 'user'|'assistant'; text: string }>>([])
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
      setRunState((s) => s ? { ...s, liveFrame: data.frame.data_url, selected: s.steps.length } : s)
    })

    es.addEventListener('progress.append', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      const step: Step = { id: data.step.id, text: data.step.text, dataUrl: data.step.screenshot.data_url }
      setRunState((s) => s ? { ...s, mode: 'run', steps: [...s.steps, step], selected: s.steps.length + 1 } : s)
    })

    es.addEventListener('task.awaiting_user', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setRunState((s) => s ? { ...s, mode: 'answer', answerText: data.text, awaitingUser: !!data.show_ack_button } : s)
    })

    es.addEventListener('task.completed', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setRunState((s) => s ? { ...s, mode: 'answer', answerText: data.text, awaitingUser: false } : s)
    })

    es.addEventListener('task.failed', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setRunState((s) => s ? { ...s, mode: 'answer', answerText: `失败：${data.text}`, awaitingUser: false } : s)
    })

    return () => es.close()
  }, [])

  const onSend = async () => {
    const text = input.trim()
    if (!text) return
    setMessages((m) => [...m, { role: 'user', text }])
    setInput('')
    await fetch(`${API_BASE}/api/chat/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sessionIdRef.current, text })
    })
  }

  const onStop = async () => {
    if (!currentTaskId) return
    await fetch(`${API_BASE}/api/chat/stop`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task_id: currentTaskId })
    })
  }

  const onAck = async () => {
    if (!currentTaskId) return
    await fetch(`${API_BASE}/api/chat/ack-user-action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task_id: currentTaskId })
    })
  }

  return (
    <div className="grid h-screen grid-cols-[260px_1fr]">
      <aside className="border-r border-border p-4">
        <h2 className="text-xl font-semibold">EasyAgentCU</h2>
      </aside>
      <main className="flex h-screen flex-col">
        <div className="flex-1 space-y-3 overflow-auto p-4">
          {messages.map((m, idx) => (
            <div key={idx} className={m.role === 'user' ? 'ml-auto w-fit max-w-[70%] rounded-xl bg-secondary px-4 py-2' : 'mr-auto w-fit max-w-[78%] rounded-xl bg-secondary px-4 py-2'}>
              {m.role === 'user' ? m.text : <RunPanel runState={runState} onAck={onAck} setRunState={setRunState} />}
            </div>
          ))}
        </div>
        <div className="border-t border-border p-4">
          <div className="flex gap-3">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="描述任务" />
            <div className="flex flex-col gap-2">
              <Button onClick={onSend}>发送</Button>
              <Button variant="secondary" onClick={onStop}>停止</Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function RunPanel({ runState, onAck, setRunState }: { runState: RunState | null; onAck: () => Promise<void>; setRunState: React.Dispatch<React.SetStateAction<RunState | null>> }) {
  if (!runState) return <div>正在思考</div>

  if (runState.mode === 'answer') {
    return (
      <div className="space-y-2">
        <div className="whitespace-pre-wrap">{runState.answerText}</div>
        {runState.awaitingUser ? <Button size="sm" onClick={onAck}>我已经操作</Button> : null}
      </div>
    )
  }

  const selectedFrame = runState.selected === runState.steps.length
    ? runState.liveFrame
    : runState.steps[runState.selected]?.dataUrl ?? runState.liveFrame

  return (
    <div className="w-[min(860px,80vw)] space-y-2 rounded-xl border border-border p-3">
      <Collapsible.Root open={!runState.collapsed} onOpenChange={(v) => setRunState((s) => s ? { ...s, collapsed: !v } : s)}>
        <Collapsible.Trigger asChild>
          <button className="flex w-full items-center justify-between text-left font-medium">
            <span>{runState.collapsed ? (runState.steps.at(-1)?.text ?? '正在思考') : '进展列表'}</span>
            <span className="text-xs text-muted">{runState.collapsed ? '展开' : '收起'}</span>
          </button>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div className="mt-2 max-h-40 space-y-1 overflow-auto border-l border-border pl-3">
            {runState.steps.map((step, idx) => (
              <button key={step.id} className={`block w-full rounded px-2 py-1 text-left text-sm ${idx === runState.selected ? 'bg-secondary' : ''}`} onClick={() => setRunState((s) => s ? { ...s, selected: idx } : s)}>
                {idx + 1}. {step.text}
              </button>
            ))}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      <div className="rounded-lg border border-border bg-black/20 p-2">
        {selectedFrame ? <img src={selectedFrame} alt="screen" className="w-full rounded" /> : null}
        <div className="mt-2 flex items-center gap-2">
          {runState.steps.map((step, idx) => (
            <button key={step.id} className={`size-3 rounded-full ${idx === runState.selected ? 'bg-white' : 'bg-neutral-500'}`} onClick={() => setRunState((s) => s ? { ...s, selected: idx } : s)} />
          ))}
          <button className={`size-3 rounded-full ${runState.selected === runState.steps.length ? 'bg-white' : 'bg-neutral-500'}`} onClick={() => setRunState((s) => s ? { ...s, selected: s.steps.length } : s)} />
          <span className="text-xs text-muted">直播</span>
        </div>
      </div>
    </div>
  )
}
