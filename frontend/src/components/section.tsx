import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Section({
  children,
  className,
  id,
  border = false,
  container = true,
}: {
  children: ReactNode
  className?: string
  id?: string
  border?: boolean
  container?: boolean
}) {
  return (
    <section
      id={id}
      className={cn('py-20 sm:py-24 lg:py-28', border && 'border-t border-border', className)}
    >
      {container ? <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div> : children}
    </section>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-3 py-1 font-mono text-xs uppercase tracking-widest text-primary',
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-primary" aria-hidden />
      {children}
    </span>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  align?: 'center' | 'left'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl md:text-[2.75rem] md:leading-[1.1] text-balance">
        {title}
      </h2>
      {description ? (
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty">{description}</p>
      ) : null}
    </div>
  )
}
