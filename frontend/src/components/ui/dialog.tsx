import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Dialog({
  open,
  onClose,
  className,
  children,
}: {
  open: boolean
  onClose: () => void
  className?: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  // Portalled to <body> on purpose. A `fixed` overlay is positioned against the
  // viewport only while no ancestor establishes a containing block — and an
  // ancestor with a `transform` does exactly that, which any `animate-*` utility
  // leaves behind permanently (the animation's fill mode keeps `translateY(0)`).
  // Rendering the report page's Share dialog in place put the backdrop over the
  // report and the panel thousands of pixels down the page, so the user saw a
  // fogged screen and nothing else.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="animate-fade-in absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'animate-scale-in relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/30',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

// Export the sub-components that were missing
export function DialogContent({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}

export function DialogHeader({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 text-center sm:text-left", className)}>
      {children}
    </div>
  )
}

export function DialogTitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>
      {children}
    </h2>
  )
}

export function DialogDescription({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      {children}
    </p>
  )
}

export function DialogFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2", className)}>
      {children}
    </div>
  )
}

export function DialogTrigger({
  children,
  onClick,
}: {
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <div onClick={onClick}>
      {children}
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {destructive ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-destructive/30">
              <AlertTriangle className="size-4 text-destructive" />
            </span>
          ) : null}
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}