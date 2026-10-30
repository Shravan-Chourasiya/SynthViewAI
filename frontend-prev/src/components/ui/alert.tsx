import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ring-1 ring-inset',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary ring-primary/25',
        strong:
          'bg-[var(--signal-strong)]/10 text-[var(--signal-strong)] ring-[var(--signal-strong)]/30',
        warning:
          'bg-[var(--signal-vague)]/10 text-[var(--signal-vague)] ring-[var(--signal-vague)]/30',
        destructive: 'bg-destructive/10 text-destructive ring-destructive/30',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode
}

export function Alert({ className, variant, icon, children, ...props }: AlertProps) {
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0">{children}</div>
    </div>
  )
}