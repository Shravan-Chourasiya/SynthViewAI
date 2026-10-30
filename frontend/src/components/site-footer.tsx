import { Link } from 'react-router-dom'
import { BrandLockup } from './brand-mark'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Interview types', to: '/#interview-types' },
      { label: 'How it works', to: '/#how-it-works' },
      { label: 'Reports', to: '/#reports' },
      { label: 'Analytics', to: '/analytics' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { label: 'Create an account', to: '/register' },
      { label: 'Sign in', to: '/login' },
      { label: 'New interview', to: '/interviews/new' },
      { label: 'Dashboard', to: '/dashboard' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Principles', to: '/#principles' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="space-y-3">
            <BrandLockup />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              An adaptive AI interviewer that listens, evaluates and adjusts in real time — then tells you
              the truth about what it heard.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {column.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="rounded text-sm text-foreground/80 transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
            © {new Date().getFullYear()} SynthView AI
          </p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            UI prototype · mock data
          </p>
        </div>
      </div>
    </footer>
  )
}
