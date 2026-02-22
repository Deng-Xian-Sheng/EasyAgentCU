import * as React from 'react'
import { cn } from '@/lib/utils'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return <textarea ref={ref} className={cn('w-full min-h-16 rounded-xl border border-border bg-secondary p-3 text-sm outline-none', className)} {...props} />
  }
)
Textarea.displayName = 'Textarea'
