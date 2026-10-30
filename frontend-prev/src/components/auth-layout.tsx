import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '@/components/theme-toggle'
import { BrandMark } from '@/components/brand-mark'

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <div
        aria-hidden="true"
        className="bg-grid bg-grid-fade pointer-events-none absolute inset-0"
      />

      <header className="relative z-10 mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark className="size-9" />
          <span className="text-[15px] font-semibold tracking-tight">
            SynthView <span className="text-primary">AI</span>
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16 pt-4">
        <div className="w-full max-w-md">
          <div className="animate-auth-card-in rounded-2xl border border-border bg-card p-7 shadow-xl shadow-black/20 sm:p-8">
            <div className="relative mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
              <span className="animate-focus-pulse absolute inset-0 rounded-2xl bg-primary/20" />
              <span className="animate-focus-pulse-2 absolute inset-0 rounded-2xl bg-primary/15" />
              <BrandMark className="relative size-9" />
            </div>
            <h1 className="text-balance text-center text-xl font-semibold tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1.5 text-center text-sm text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </main>
    </div>
  )
}