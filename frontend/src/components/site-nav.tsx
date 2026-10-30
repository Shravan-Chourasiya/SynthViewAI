import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { BrandLockup } from './brand-mark'
import { ThemeToggle } from './theme-toggle'
import { Magnetic } from './motion/magnetic'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/interviews', label: 'Interviews' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <header
      className={cn(
        'site-nav fixed inset-x-0 top-0 z-50 border-b border-transparent transition-all duration-300',
        scrolled && 'border-border bg-background/80 backdrop-blur-xl',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          viewTransition
          className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLockup />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              viewTransition
              className={({ isActive }) =>
                cn(
                  'rounded-md text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/login"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'hidden lg:inline-flex')}
          >
            Sign In
          </Link>
          <Magnetic strength={0.18} className="hidden lg:inline-flex">
            <Link to="/register" className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}>
              Get Started
            </Link>
          </Magnetic>
          <Button
            variant="outline"
            size="icon-sm"
            className="lg:hidden"
            aria-expanded={open}
            aria-controls="site-nav-mobile"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      <div
        id="site-nav-mobile"
        className={cn(
          'overflow-hidden border-border bg-background/95 backdrop-blur-xl transition-[max-height,opacity] duration-300 ease-out lg:hidden',
          open ? 'max-h-96 border-t opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-muted',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
          <div className="mt-3 grid gap-2">
            <Link to="/login" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')}>
              Sign In
            </Link>
            <Link to="/register" className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full')}>
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
