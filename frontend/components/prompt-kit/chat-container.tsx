'use client'

import { cn } from '@/lib/utils'
import { StickToBottom } from 'use-stick-to-bottom'

export function ChatContainerRoot({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <StickToBottom className={cn('flex overflow-y-auto', className)} resize="smooth" initial="instant" role="log" {...props}>
      {children}
    </StickToBottom>
  )
}

export function ChatContainerContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <StickToBottom.Content className={cn('flex w-full flex-col', className)} {...props}>
      {children}
    </StickToBottom.Content>
  )
}
