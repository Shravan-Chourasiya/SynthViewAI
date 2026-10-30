import type * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { InterviewStatus, SignalBand } from '@/lib/types'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider tabular-nums ring-1',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary ring-primary/25',
        neutral: 'bg-secondary text-muted-foreground ring-border',
        strong: 'bg-signal-strong/10 text-signal-strong ring-signal-strong/25',
        good: 'bg-signal-good/10 text-signal-good ring-signal-good/25',
        vague: 'bg-signal-vague/10 text-signal-vague ring-signal-vague/25',
        weak: 'bg-signal-weak/10 text-signal-weak ring-signal-weak/25',
        outline: 'bg-transparent text-foreground ring-border',
        destructive: 'bg-destructive/10 text-destructive ring-destructive/25',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.ComponentProps<'span'>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
  dotClassName?: string
}

export function Badge({ className, variant, dot = false, dotClassName, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? (
        <span className={cn('size-1.5 rounded-full bg-current', dotClassName)} aria-hidden />
      ) : null}
      {children}
    </span>
  )
}

const STATUS_VARIANT: Record<InterviewStatus, BadgeProps['variant']> = {
  draft: 'neutral',
  scheduled: 'default',
  'in-progress': 'vague',
  completed: 'strong',
  abandoned: 'weak',
}

const STATUS_TEXT: Record<InterviewStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  'in-progress': 'In progress',
  completed: 'Completed',
  abandoned: 'Abandoned',
}

/** Unknown statuses fall back to neutral rather than crashing. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const known = status in STATUS_VARIANT ? (status as InterviewStatus) : null
  return (
    <Badge variant={known ? STATUS_VARIANT[known] : 'neutral'} dot className={className}>
      {known ? STATUS_TEXT[known] : status}
    </Badge>
  )
}

/** signal colours are functional: strong=green, good=blue, vague=amber, weak=red */
export function SignalBadge({
  band,
  children,
  className,
}: {
  band: SignalBand
  children?: React.ReactNode
  className?: string
}) {
  return (
    <Badge variant={band} className={className}>
      {children ?? band}
    </Badge>
  )
}

export { badgeVariants }
