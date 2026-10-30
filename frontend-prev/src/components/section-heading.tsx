import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/reveal'

interface SectionHeadingProps {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  align?: 'left' | 'center'
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: SectionHeadingProps) {
  return (
    <Reveal
      className={cn(
        'flex flex-col gap-4',
        align === 'center' ? 'items-center text-center' : 'items-start',
        className,
      )}
    >
      {eyebrow ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-3 py-1 font-mono text-xs uppercase tracking-widest text-primary">
          <span className="size-1.5 rounded-full bg-primary" />
          {eyebrow}
        </span>
      ) : null}
      <h2
        className={cn(
          'text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-[2.75rem] md:leading-[1.1]',
          align === 'center' && 'max-w-3xl',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg',
            align === 'center' ? 'max-w-2xl' : 'max-w-xl',
          )}
        >
          {description}
        </p>
      ) : null}
    </Reveal>
  )
}