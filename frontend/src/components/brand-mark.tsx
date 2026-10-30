import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={cn('size-9', className)}
      fill="none"
      role="img"
      aria-label="SynthView AI"
    >
      <defs>
        <linearGradient id="bm-left" x1="18" y1="16" x2="66" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-mark-left-start)" />
          <stop offset="1" stopColor="var(--brand-mark-left-end)" />
        </linearGradient>
        <linearGradient id="bm-right" x1="110" y1="16" x2="62" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-mark-right-start)" />
          <stop offset="1" stopColor="var(--brand-mark-right-end)" />
        </linearGradient>
      </defs>
      <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="6">
        <path d="M60 20C40 12 22 22 20 40c-2 14 6 22 2 34-4 14 10 30 26 30 8 0 12-6 12-14" stroke="url(#bm-left)" />
        <path d="M60 20v82" stroke="url(#bm-left)" />
        <path d="M68 20c20-8 38 2 40 20 2 14-6 22-2 34 4 14-10 30-26 30-8 0-12-6-12-14" stroke="url(#bm-right)" />
        <path d="M68 20v82" stroke="url(#bm-right)" />
        <path d="M60 44H42l-6-6" stroke="url(#bm-left)" />
        <path d="M60 66H40" stroke="url(#bm-left)" />
        <path d="M60 88H46l-6 8" stroke="url(#bm-left)" />
        <path d="M68 34h18l6-6" stroke="url(#bm-right)" />
        <path d="M68 58h22" stroke="url(#bm-right)" />
        <path d="M68 82h16l8 8" stroke="url(#bm-right)" />
      </g>
      <path d="M64 14v100" stroke="url(#bm-left)" strokeWidth="5" strokeLinecap="round" />
      <g fill="var(--brand-mark-left-end)">
        <circle cx="36" cy="38" r="4" />
        <circle cx="40" cy="66" r="4" />
        <circle cx="40" cy="96" r="4" />
      </g>
      <g fill="var(--brand-mark-right-end)">
        <circle cx="92" cy="28" r="5" />
        <circle cx="90" cy="58" r="5" />
        <circle cx="92" cy="90" r="5" />
      </g>
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-[15px] font-semibold tracking-tight', className)}>
      SynthView<span className="text-primary">AI</span>
    </span>
  )
}

export function BrandLockup({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark className={compact ? 'size-8' : 'size-9'} />
      <Wordmark />
    </span>
  )
}
