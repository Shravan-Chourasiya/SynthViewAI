import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from './theme-context'
import { cn } from '@/lib/utils'

export function ThemeToggle({
  className,
  size = 'icon-sm',
}: {
  className?: string
  size?: 'icon-xs' | 'icon-sm' | 'icon'
}) {
  const { resolvedTheme, toggle } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => toggle()}
      className={cn('text-muted-foreground', className)}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
