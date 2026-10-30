import type { ComponentProps, ElementType, ReactNode } from 'react'
import { useSpotlight, useTilt } from '@/hooks/use-tilt'
import { cn } from '@/lib/utils'

/**
 * A card that tilts in 3D toward the cursor and carries a glare highlight.
 * Falls back to a completely static surface under reduced motion or on touch.
 */
export function TiltCard({
  children,
  className,
  max = 8,
  lift = 14,
  glare = true,
  sheen = false,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  max?: number
  lift?: number
  glare?: boolean
  sheen?: boolean
  as?: ElementType
}) {
  const Tag = as as ElementType
  const tiltRef = useTilt<HTMLElement>({ max, lift })

  return (
    <Tag ref={tiltRef} className={cn('sv-tilt relative', sheen && 'sv-sheen', className)}>
      {children}
      {glare ? <span aria-hidden className="sv-tilt-glare" /> : null}
    </Tag>
  )
}

/** Surface with a cursor-following spotlight. Pair with rounded/overflow classes. */
export function SpotlightPanel({
  children,
  className,
  as = 'div',
  ...props
}: {
  children: ReactNode
  className?: string
  as?: ElementType
} & Omit<ComponentProps<'div'>, 'children' | 'className'>) {
  const Tag = as as ElementType
  const spotRef = useSpotlight<HTMLElement>()
  return (
    <Tag ref={spotRef} className={cn('sv-spotlight relative isolate', className)} {...props}>
      {children}
    </Tag>
  )
}
