'use client'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

export function Steps({ defaultOpen = true, className, ...props }: React.ComponentProps<typeof Collapsible>) {
  return <Collapsible className={cn(className)} defaultOpen={defaultOpen} {...props} />
}

export function StepsTrigger({ children, className, ...props }: React.ComponentProps<typeof CollapsibleTrigger>) {
  return (
    <CollapsibleTrigger className={cn('group flex w-full items-center justify-between text-left text-sm', className)} {...props}>
      <span>{children}</span>
      <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  )
}

export function StepsContent({ children, className, ...props }: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent className={cn('overflow-hidden', className)} {...props}>
      <div className="mt-2 grid grid-cols-[2px_1fr] gap-3">
        <div className="bg-border" />
        <div className="space-y-2">{children}</div>
      </div>
    </CollapsibleContent>
  )
}

export function StepsItem({ children, className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button className={cn('block w-full rounded-md px-2 py-1 text-left text-sm text-foreground/90 hover:bg-secondary', className)} {...props}>
      {children}
    </button>
  )
}
