'use client'

import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import React, { createContext, useContext, useLayoutEffect, useRef, useState } from 'react'

type PromptInputContextType = {
  value: string
  setValue: (value: string) => void
  onSubmit?: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
}

const PromptInputContext = createContext<PromptInputContextType>({
  value: '',
  setValue: () => {},
  onSubmit: undefined,
  textareaRef: { current: null },
})

export function PromptInput({ className, value, onValueChange, onSubmit, children, ...props }: React.ComponentProps<'div'> & { value?: string; onValueChange?: (v:string)=>void; onSubmit?: ()=>void }) {
  const [internal, setInternal] = useState(value ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const val = value ?? internal
  return (
    <PromptInputContext.Provider value={{ value: val, setValue: onValueChange ?? setInternal, onSubmit, textareaRef }}>
      <div className={cn('rounded-3xl border border-border bg-secondary p-2', className)} {...props}>{children}</div>
    </PromptInputContext.Provider>
  )
}

export function PromptInputTextarea({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  const { value, setValue, onSubmit, textareaRef } = useContext(PromptInputContext)
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [value, textareaRef])

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault(); onSubmit?.()
        }
      }}
      className={cn('min-h-[44px] resize-none border-0 bg-transparent p-2 shadow-none focus-visible:ring-0', className)}
      {...props}
    />
  )
}

export function PromptInputActions({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-2', className)} {...props} />
}
