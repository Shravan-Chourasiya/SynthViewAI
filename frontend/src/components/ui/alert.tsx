import type * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-xl border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-card-foreground',
        info: 'border-primary/30 bg-primary/5 text-foreground',
        warning: 'border-signal-vague/30 bg-signal-vague/5 text-foreground',
        destructive: 'border-destructive/30 bg-destructive/5 text-foreground [&>svg]:text-destructive',
        success: 'border-signal-strong/30 bg-signal-strong/5 text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

export function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('col-start-2 text-sm font-medium tracking-tight', className)} {...props} />
}

export function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('col-start-2 text-sm text-muted-foreground [&_p]:leading-relaxed', className)} {...props} />
  )
}
