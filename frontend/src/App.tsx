import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { useTheme } from '@/components/theme-context'
import { AppShell } from '@/components/app-shell'
import { SmoothScroll } from '@/components/motion/smooth-scroll'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { ScrollProgress } from '@/components/scroll-progress'
import { CommandPalette } from '@/components/command-palette'
import { useAuthStore } from '@/lib/stores/auth-store'
import { GuestOnly, RequireAdmin, RequireAuth, RouteFallback } from '@/components/route-guards'
import { startHealthCheck } from '@/lib/health-check'

/* ------------------------------------------------------------------ routes */

const LandingPage = lazy(() => import('@/pages/landing'))
const AboutPage = lazy(() => import('@/pages/public-info').then((m) => ({ default: m.AboutPage })))
const ContactPage = lazy(() => import('@/pages/public-info').then((m) => ({ default: m.ContactPage })))
const PrivacyPage = lazy(() => import('@/pages/public-info').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('@/pages/public-info').then((m) => ({ default: m.TermsPage })))
const NotFoundPage = lazy(() => import('@/pages/not-found'))

const LoginPage = lazy(() => import('@/pages/auth/login'))
const RegisterPage = lazy(() => import('@/pages/auth/register'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/forgot-password'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/reset-password'))

const DashboardPage = lazy(() => import('@/pages/dashboard'))
const InterviewHistoryPage = lazy(() => import('@/pages/interviews/history'))
const NewInterviewPage = lazy(() => import('@/pages/interviews/new'))
const ResumablePage = lazy(() => import('@/pages/interviews/resumable'))
const InterviewDetailPage = lazy(() => import('@/pages/interviews/detail'))
const LobbyPage = lazy(() => import('@/pages/interviews/lobby'))
const LiveRoomPage = lazy(() => import('@/pages/interviews/live'))
const CompletedPage = lazy(() => import('@/pages/interviews/completed'))
const TimelinePage = lazy(() => import('@/pages/interviews/timeline'))
const MetricsPage = lazy(() => import('@/pages/interviews/metrics'))
const ReportPage = lazy(() => import('@/pages/interviews/report'))
const SharedReportPage = lazy(() => import('@/pages/interviews/shared-report'))
const AnalyticsPage = lazy(() => import('@/pages/analytics'))
const ProfilePage = lazy(() => import('@/pages/profile'))
const SettingsPage = lazy(() => import('@/pages/settings/index'))
const SessionsPage = lazy(() => import('@/pages/settings/sessions'))

const AdminOverviewPage = lazy(() => import('@/pages/admin/index'))
const AdminUsersPage = lazy(() => import('@/pages/admin/users'))
const AdminInterviewsPage = lazy(() => import('@/pages/admin/interviews'))
const AdminInterviewReportPage = lazy(() => import('@/pages/admin/interview-report'))

/* ------------------------------------------------------------------- shell */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

// ── AuthBootstrap ─────────────────────────────────────────────────────────────
// Calls bootstrap() once on mount. Renders children immediately so public
// routes (landing, about, etc.) are never blocked.

function AuthBootstrap({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const status = useAuthStore((s) => s.status)

  useEffect(() => {
    if (status === 'idle') void bootstrap()
  }, [bootstrap, status])

  return <>{children}</>
}

// ── Layouts ───────────────────────────────────────────────────────────────────

function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteNav />
      <ScrollProgress />
      <main className="flex-1 pt-16">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

// ── Toaster ───────────────────────────────────────────────────────────────────

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      theme={resolvedTheme}
      position="bottom-right"
      closeButton
      richColors
      expand
      visibleToasts={5}
      toastOptions={{
        duration: 4500,
        classNames: {
          toast:
            'rounded-xl border border-border bg-popover/95 text-popover-foreground shadow-xl backdrop-blur-sm font-sans text-sm',
          description: 'text-muted-foreground text-xs',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-secondary text-secondary-foreground',
          closeButton: 'border-border bg-popover text-muted-foreground hover:text-foreground',
          success: 'border-signal-strong/30 bg-signal-strong/5',
          error: 'border-destructive/30 bg-destructive/5',
          warning: 'border-signal-vague/30 bg-signal-vague/5',
          info: 'border-primary/30 bg-primary/5',
        },
      }}
    />
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  useEffect(startHealthCheck, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthBootstrap>
            <SmoothScroll>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  {/* public */}
                  <Route element={<PublicLayout />}>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>

                  {/* guest-only auth */}
                  <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
                  <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
                  <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
                  <Route path="/reset-password" element={<GuestOnly><ResetPasswordPage /></GuestOnly>} />

                  {/* public share link */}
                  <Route path="/interviews/shared/:token" element={<SharedReportPage />} />

                  {/* authenticated app */}
                  <Route
                    element={
                      <RequireAuth>
                        <AppShell />
                      </RequireAuth>
                    }
                  >
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/interviews" element={<InterviewHistoryPage />} />
                    <Route path="/interviews/new" element={<NewInterviewPage />} />
                    <Route path="/interviews/resumable" element={<ResumablePage />} />
                    <Route path="/interviews/:id" element={<InterviewDetailPage />} />
                    <Route path="/interviews/:id/lobby" element={<LobbyPage />} />
                    <Route path="/interviews/:id/live" element={<LiveRoomPage />} />
                    <Route path="/interviews/:id/completed" element={<CompletedPage />} />
                    <Route path="/interviews/:id/history" element={<TimelinePage />} />
                    <Route path="/interviews/:id/metrics" element={<MetricsPage />} />
                    <Route path="/interviews/:id/report" element={<ReportPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/settings/sessions" element={<SessionsPage />} />
                    <Route path="/admin" element={<RequireAdmin><AdminOverviewPage /></RequireAdmin>} />
                    <Route path="/admin/users" element={<RequireAdmin><AdminUsersPage /></RequireAdmin>} />
                    <Route path="/admin/interviews" element={<RequireAdmin><AdminInterviewsPage /></RequireAdmin>} />
                    <Route path="/admin/interviews/:id/report" element={<RequireAdmin><AdminInterviewReportPage /></RequireAdmin>} />
                  </Route>
                </Routes>
              </Suspense>
              <CommandPalette />
            </SmoothScroll>
          </AuthBootstrap>
        </BrowserRouter>
        <ThemedToaster />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
