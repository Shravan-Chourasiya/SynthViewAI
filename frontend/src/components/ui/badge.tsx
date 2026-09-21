import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { STATUS_META, type InterviewStatus } from '@/lib/types'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ring-1 ring-inset',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary ring-primary/25',
        strong:
          'bg-[var(--signal-strong)]/10 text-[var(--signal-strong)] ring-[var(--signal-strong)]/25',
        good: 'bg-[var(--signal-good)]/10 text-[var(--signal-good)] ring-[var(--signal-good)]/25',
        vague:
          'bg-[var(--signal-vague)]/10 text-[var(--signal-vague)] ring-[var(--signal-vague)]/25',
        weak: 'bg-[var(--signal-weak)]/10 text-[var(--signal-weak)] ring-[var(--signal-weak)]/25',
        neutral: 'bg-secondary text-muted-foreground ring-border',
        outline: 'bg-transparent text-muted-foreground ring-border',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

export function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: InterviewStatus }) {
  // Unknown / future statuses (or a raw backend value that slipped through the
  // normalizer) must render a neutral badge — never crash the whole page by
  // reading `.variant` off `undefined`.
  const meta = STATUS_META[status] ?? { label: String(status ?? 'Unknown'), variant: 'neutral' as const }
  return (
    <Badge variant={meta.variant} dot>
      {meta.label}
    </Badge>
  )
}