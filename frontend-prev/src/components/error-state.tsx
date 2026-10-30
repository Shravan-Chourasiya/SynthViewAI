import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function ErrorState({
  code,
  title,
  body,
  children,
  className,
}: {
  code: string
  title: string
  body: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center',
        className,
      )}
    >
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Error {code}
      </p>
      <h1 className="mt-3 text-balance text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      {children ? (
        <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>
      ) : null}
    </div>
  )
}