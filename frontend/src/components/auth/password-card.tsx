import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'

export function PasswordCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-60" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <span className="relative flex size-14 items-center justify-center rounded-2xl border border-border bg-card shadow-lg">
            <span
              aria-hidden
              className="absolute inset-0 animate-focus-pulse rounded-2xl border border-primary/40"
            />
            <span
              aria-hidden
              className="absolute inset-0 animate-focus-pulse-2 rounded-2xl border border-primary/30"
            />
            <BrandMark className="size-8" />
          </span>
        </div>

        <div className="animate-auth-card-in rounded-3xl border border-border bg-card p-6 shadow-xl shadow-black/10 sm:p-8">
          <header className="space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">{eyebrow}</p>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </header>
          <div className="mt-6">{children}</div>
        </div>

        <Link
          to="/login"
          className="mx-auto mt-6 flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
