import { Check, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const rules = [
  { id: 'len', label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { id: 'letter', label: 'At least one letter', test: (v: string) => /[A-Za-z]/.test(v) },
  { id: 'num', label: 'At least one number', test: (v: string) => /\d/.test(v) },
  {
    id: 'nows',
    label: 'No spaces or special whitespace',
    test: (v: string) => !/\s/.test(v),
  },
]

export function passwordIsValid(value: string) {
  return rules.every((r) => r.test(value))
}

/**
 * The original always-visible checklist. Still used by the auth flows where a
 * persistent prompt is appropriate (see `reset-password.tsx` for the compact
 * hover variant).
 */
export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {rules.map((r) => {
        const ok = r.test(value)
        return (
          <li
            key={r.id}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors',
              ok ? 'text-signal-strong' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-4 items-center justify-center rounded-full ring-1 transition-colors',
                ok
                  ? 'bg-(--signal-strong)/15 ring-(--signal-strong)/30'
                  : 'bg-secondary ring-border',
              )}
            >
              {ok ? <Check className="size-2.5" strokeWidth={3} /> : null}
            </span>
            {r.label}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Compact password-rules helper: an info button that reveals the checklist on
 * hover (and on keyboard focus / tap, so it is not hover-only for keyboard and
 * touch users). Replaces the always-visible list used previously.
 */
export function PasswordRulesInfo({ value }: { value: string }) {
  return (
    <div className="group relative inline-flex" data-password-rules>
      <button
        type="button"
        aria-label="Password requirements"
        aria-expanded="false"
        className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="size-4" />
      </button>

      {/* Anchored panel: shown on hover over the button, or while the button
          holds focus — Escape is not needed since nothing is trapped. */}
      <div
        role="note"
        aria-label="Password requirements"
        className="pointer-events-none absolute right-0 top-9 z-30 w-64 rounded-xl border border-border bg-card p-3.5 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Password requirements
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {rules.map((r) => {
            const ok = r.test(value)
            return (
              <li
                key={r.id}
                className={cn(
                  'flex items-center gap-2 text-xs transition-colors',
                  ok ? 'text-signal-strong' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex size-4 items-center justify-center rounded-full ring-1 transition-colors',
                    ok
                      ? 'bg-(--signal-strong)/15 ring-(--signal-strong)/30'
                      : 'bg-secondary ring-border',
                  )}
                >
                  {ok ? <Check className="size-2.5" strokeWidth={3} /> : null}
                </span>
                {r.label}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
