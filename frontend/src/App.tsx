import { lazy, Suspense } from 'react'
import { Routes, Route, Link, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ErrorState } from '@/components/error-state'
import { AuthBootstrap, RequireAuth, RequireAdmin } from '@/components/require-auth'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useTheme } from '@/components/theme-provider'
import { AuthPage } from '@/pages/auth/auth'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*  Lazy-loaded page modules                                                  */
/* -------------------------------------------------------------------------- */

// Public
const LandingPage = lazy(() => import('@/pages/landing').then((m) => ({ default: m.LandingPage })))
const AboutPage = lazy(() => import('@/pages/public-info').then((m) => ({ default: m.AboutPage })))
const ContactPage = lazy(() => import('@/pages/public-info').then((m) => ({ default: m.ContactPage })))
const PrivacyPage = lazy(() => import('@/pages/public-info').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('@/pages/public-info').then((m) => ({ default: m.TermsPage })))
// Note: We no longer need the separate VerifyEmailPage since it's integrated into AuthPage
const ForgotPasswordPage = lazy(() => import('@/pages/auth/forgot-password').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('@/pages/auth/reset-password').then((m) => ({ default: m.ResetPasswordPage })))

// Candidate app
const DashboardPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.DashboardPage })))
const InterviewsPage = lazy(() => import('@/pages/interviews/history').then((m) => ({ default: m.InterviewsPage })))
const ResumablePage = lazy(() => import('@/pages/interviews/resumable').then((m) => ({ default: m.ResumablePage })))
const NewInterviewPage = lazy(() => import('@/pages/interviews/new').then((m) => ({ default: m.NewInterviewPage })))
const LobbyPage = lazy(() => import('@/pages/interviews/lobby').then((m) => ({ default: m.LobbyPage })))
const LiveRoomPage = lazy(() => import('@/pages/interviews/live').then((m) => ({ default: m.LiveRoomPage })))
const CompletedPage = lazy(() => import('@/pages/interviews/completed').then((m) => ({ default: m.CompletedPage })))
const InterviewDetailPage = lazy(() => import('@/pages/interviews/detail').then((m) => ({ default: m.InterviewDetailPage })))
const InterviewTimelinePage = lazy(() => import('@/pages/interviews/timeline').then((m) => ({ default: m.InterviewTimelinePage })))
const InterviewMetricsPage = lazy(() => import('@/pages/interviews/metrics').then((m) => ({ default: m.InterviewMetricsPage })))
const InterviewReportPage = lazy(() => import('@/pages/interviews/report').then((m) => ({ default: m.InterviewReportPage })))
const AnalyticsPage = lazy(() => import('@/pages/analytics').then((m) => ({ default: m.AnalyticsPage })))
const ProfilePage = lazy(() => import('@/pages/profile').then((m) => ({ default: m.ProfilePage })))
const SettingsPage = lazy(() => import('@/pages/settings').then((m) => ({ default: m.SettingsPage })))
const SessionsPage = lazy(() => import('@/pages/sessions').then((m) => ({ default: m.SessionsPage })))
const SharedReportPage = lazy(() => import('@/pages/interviews/shared-report'))

// Admin
const AdminOverviewPage = lazy(() => import('@/pages/admin/overview').then((m) => ({ default: m.AdminOverviewPage })))
const AdminUsersPage = lazy(() => import('@/pages/admin/users').then((m) => ({ default: m.AdminUsersPage })))
const AdminInterviewsPage = lazy(() => import('@/pages/admin/interviews').then((m) => ({ default: m.AdminInterviewsPage })))

/* -------------------------------------------------------------------------- */
/*  Suspense fallbacks                                                        */
/* -------------------------------------------------------------------------- */

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <Skeleton className="h-24 w-full max-w-md rounded-2xl" />
    </div>
  )
}

function PublicFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <Skeleton className="h-48 w-full max-w-3xl rounded-2xl" />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Guards                                                                    */
/* -------------------------------------------------------------------------- */

function GuestOnly({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status)
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

/* -------------------------------------------------------------------------- */
/*  Router                                                                    */
/* -------------------------------------------------------------------------- */

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster position="top-right" duration={3000} theme={theme} />;
}

export default function App() {
  return (
    <AuthBootstrap>
      <ThemedToaster />
      <Routes>
        {/* public */}
        <Route path="/" element={<Suspense fallback={<PublicFallback />}><LandingPage /></Suspense>} />
        <Route path="/about" element={<Suspense fallback={<PublicFallback />}><AboutPage /></Suspense>} />
        <Route path="/contact" element={<Suspense fallback={<PublicFallback />}><ContactPage /></Suspense>} />
        <Route path="/privacy" element={<Suspense fallback={<PublicFallback />}><PrivacyPage /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={<PublicFallback />}><TermsPage /></Suspense>} />
        <Route path="/login" element={<GuestOnly><AuthPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><AuthPage /></GuestOnly>} />
        {/* Remove separate verify-email route - now integrated into AuthPage */}
        <Route path="/forgot-password" element={<Suspense fallback={<PublicFallback />}><ForgotPasswordPage /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={<PublicFallback />}><ResetPasswordPage /></Suspense>} />
        {/* Public share-link viewer — no auth, by design (doc 07 Task C stretch). */}
        <Route path="/interviews/shared/:token" element={<Suspense fallback={<PublicFallback />}><SharedReportPage /></Suspense>} />

        {/* candidate app */}
        <Route path="/dashboard" element={<RequireAuth><Suspense fallback={<PageFallback />}><DashboardPage /></Suspense></RequireAuth>} />
        <Route path="/interviews" element={<RequireAuth><Suspense fallback={<PageFallback />}><InterviewsPage /></Suspense></RequireAuth>} />
        <Route path="/interviews/new" element={<RequireAuth><Suspense fallback={<PageFallback />}><NewInterviewPage /></Suspense></RequireAuth>} />
        <Route path="/interviews/resumable" element={<RequireAuth><Suspense fallback={<PageFallback />}><ResumablePage /></Suspense></RequireAuth>} />
        <Route path="/interviews/:id/lobby" element={<RequireAuth><Suspense fallback={<PageFallback />}><LobbyPage /></Suspense></RequireAuth>} />
        <Route path="/interviews/:id/live" element={<RequireAuth><Suspense fallback={<PageFallback />}><LiveRoomPage /></Suspense></RequireAuth>} />
        <Route path="/interviews/:id/completed" element={<RequireAuth><Suspense fallback={<PageFallback />}><CompletedPage /></Suspense></RequireAuth>} />
        <Route path="/interviews/:id" element={<RequireAuth><Suspense fallback={<PageFallback />}><InterviewDetailPage /></Suspense></RequireAuth>} />
        <Route path="/interviews/:id/history" element={<RequireAuth><Suspense fallback={<PageFallback />}><InterviewTimelinePage /></Suspense></RequireAuth>} />
        <Route path="/interviews/:id/metrics" element={<RequireAuth><Suspense fallback={<PageFallback />}><InterviewMetricsPage /></Suspense></RequireAuth>} />
        <Route path="/interviews/:id/report" element={<RequireAuth><Suspense fallback={<PageFallback />}><InterviewReportPage /></Suspense></RequireAuth>} />
        <Route path="/analytics" element={<RequireAuth><Suspense fallback={<PageFallback />}><AnalyticsPage /></Suspense></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Suspense fallback={<PageFallback />}><ProfilePage /></Suspense></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Suspense fallback={<PageFallback />}><SettingsPage /></Suspense></RequireAuth>} />
        <Route path="/settings/sessions" element={<RequireAuth><Suspense fallback={<PageFallback />}><SessionsPage /></Suspense></RequireAuth>} />

        {/* admin */}
        <Route path="/admin" element={<RequireAdmin><Suspense fallback={<PageFallback />}><AdminOverviewPage /></Suspense></RequireAdmin>} />
        <Route path="/admin/users" element={<RequireAdmin><Suspense fallback={<PageFallback />}><AdminUsersPage /></Suspense></RequireAdmin>} />
        <Route path="/admin/interviews" element={<RequireAdmin><Suspense fallback={<PageFallback />}><AdminInterviewsPage /></Suspense></RequireAdmin>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthBootstrap>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <ErrorState
        code="404"
        title="This page doesn't exist."
        body="The interview, report or page you're looking for isn't here — it may have been cancelled or removed."
      >
        <Link to="/" className={cn(buttonVariants({ variant: 'outline' }))}>
          Back to SynthView
        </Link>
      </ErrorState>
    </div>
  )
}
