import { Link } from 'react-router-dom'
import { BrandMark } from '@/components/brand-mark'

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'How It Works', href: '/#how-it-works' },
      { label: 'Interview Types', href: '/#interview-types' },
      { label: 'Reports', href: '/#reports' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { label: 'Sign In', href: '/login' },
      { label: 'Create Account', href: '/register' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <BrandMark className="size-9" />
              <span className="text-[15px] font-semibold tracking-tight">
                SynthView <span className="text-primary">AI</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
              An AI interviewer that evaluates performance and dynamically
              changes the interview based on how you answer.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('#') || link.href.startsWith('/#') ? (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="font-mono text-xs text-muted-foreground">
            © {new Date().getFullYear()} SynthView AI. All rights reserved.
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            Adaptive interviews, built for how you actually perform.
          </p>
        </div>
      </div>
    </footer>
  )
}