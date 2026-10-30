import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { BrandMark } from '@/components/brand-mark'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'

const links = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Interviews', href: '/interviews' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300 animate-fade-in',
        scrolled
          ? 'border-b border-border bg-background/80 backdrop-blur-xl'
          : 'border-b border-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark className="size-9" />
          <span className="text-[15px] font-semibold tracking-tight">
            SynthView <span className="text-primary">AI</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                to={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <Link
            to="/login"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'text-muted-foreground hover:text-foreground',
            )}
          >
            Sign In
          </Link>
          <Link to="/register" className={cn(buttonVariants({ variant: 'default' }))}>
            Get Started
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border text-foreground focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {/* Animated mobile menu */}
      <div
        className={cn(
          'overflow-hidden border-b border-border bg-background/95 backdrop-blur-xl transition-all duration-300 ease-in-out lg:hidden',
          open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 pointer-events-none',
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
          {links.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent hover:text-foreground',
                  isActive
                    ? 'font-medium text-foreground bg-accent/60'
                    : 'text-muted-foreground',
                )}
              >
                {link.label}
              </Link>
            )
          })}
          <div className="mt-2 flex flex-col gap-2">
            <Link
              to="/login"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-center')}
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className={cn(buttonVariants({ variant: 'default' }), 'w-full justify-center')}
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}