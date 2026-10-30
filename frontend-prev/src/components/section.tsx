import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionProps {
  id?: string
  children: ReactNode
  className?: string
  bordered?: boolean
}

export function Section({ id, children, className, bordered }: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'py-20 sm:py-24 lg:py-28',
        bordered && 'border-t border-border',
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  )
}