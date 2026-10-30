import { httpGet, httpPatch, httpPost } from '../http'
import type { AdminUserRow, AnalyticsKpi, PlatformStats, UserRole, UserStatus } from '../types'

const A = (path: string) => `/admin${path}`

// ── Backend shapes ────────────────────────────────────────────────────────────

/** `listUsers` in backend/src/modules/admin/services/admin.service.ts */
interface BackendUserRow {
  id: string
  email: string
  firstName: string
  lastName: string
  userrole: 'user' | 'admin' | 'moderator' | 'owner'
  isActive: boolean // ← users.isVerified
  accountStatus: 'active' | 'suspended' | 'disabled' | 'deleted'
  createdAt: string
  updatedAt: string
  interviewCount: number
  lastInterviewAt: string | null
}

interface BackendUserList {
  users: BackendUserRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/** `getOverviewStats` in backend/src/modules/admin/services/admin.service.ts */
interface BackendOverview {
  totalUsers: number
  totalInterviews: number
  interviewsByStatus: Record<string, number>
  recentSignups: number
  activeUsers: number
}

// ── Enum mapping ──────────────────────────────────────────────────────────────
// The admin console speaks in product vocabulary (candidate / reviewer / admin,
// active / invited / suspended); the database speaks in `user_role`
// (user / moderator / admin / owner) and `account_status`. Every wire call and
// every response crosses here, so neither side has to learn the other's words.

const ROLE_TO_WIRE: Record<UserRole, 'user' | 'moderator' | 'admin'> = {
  candidate: 'user',
  reviewer: 'moderator',
  admin: 'admin',
}

const WIRE_TO_ROLE: Record<string, UserRole> = {
  user: 'candidate',
  moderator: 'reviewer',
  admin: 'admin',
  // An owner outranks admin but the console has no owner badge; show it at the
  // highest rank it does have rather than rendering an unknown label.
  owner: 'admin',
}

function toStatus(user: BackendUserRow): UserStatus {
  if (user.accountStatus === 'suspended') return 'suspended'
  // "Invited" is the console's word for an account that exists but has not
  // verified yet — the database keeps that on `is_verified`, not on status.
  if (user.accountStatus === 'active' && !user.isActive) return 'invited'
  return 'active'
}

function toUserRow(user: BackendUserRow): AdminUserRow {
  // The list projection carries no `username` column, so an account without a
  // name falls back to its email local part rather than inventing a handle.
  const username = user.email.split('@')[0] ?? user.id
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || username
  return {
    id: user.id,
    name,
    username,
    email: user.email,
    role: WIRE_TO_ROLE[user.userrole] ?? 'candidate',
    status: toStatus(user),
    interviews: user.interviewCount,
    // The admin overview endpoint carries no per-user score aggregate.
    avgScore: null,
    joinedAt: user.createdAt,
    lastActiveAt: user.lastInterviewAt ?? user.updatedAt ?? user.createdAt,
  }
}

// ── Overview mapping ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  READY: 'Ready',
  SCHEDULED: 'Scheduled',
  INPROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  ABANDONED: 'Abandoned',
  EXPIRED: 'Expired',
  TIMED_OUT: 'Timed out',
}

function toPlatformStats(raw: BackendOverview, period: string): PlatformStats {
  const kpis: AnalyticsKpi[] = [
    { label: 'Accounts', value: String(raw.totalUsers), delta: 'all time', trend: 'flat', hint: 'registered' },
    { label: 'Sessions', value: String(raw.totalInterviews), delta: 'all time', trend: 'flat', hint: 'interviews' },
    {
      label: 'New signups',
      value: String(raw.recentSignups),
      delta: `last ${period}`,
      trend: 'flat',
      hint: 'accounts',
    },
    {
      label: 'Active users',
      value: String(raw.activeUsers),
      delta: 'completed',
      trend: 'flat',
      hint: 'at least one session',
    },
  ]

  return {
    kpis,
    // No per-week cohort series exists server-side; one labelled bucket is the
    // honest representation of the aggregate that does exist. Deferred in
    // docs/frontend-backend-gaps.md.
    signups: [{ label: `Last ${period}`, users: raw.recentSignups, interviews: raw.totalInterviews }],
    statusMix: Object.entries(raw.interviewsByStatus).map(([status, count]) => ({
      status: STATUS_LABEL[status] ?? status,
      count,
    })),
    // No score-band or top-role aggregate is exposed by the backend yet.
    scoreBands: [],
    topRoles: [],
  }
}

export const adminService = {
  stats: async (period: '7d' | '30d' | '90d' = '30d'): Promise<PlatformStats> => {
    const raw = await httpGet<BackendOverview>(`${A('/overview')}?period=${period}`)
    return toPlatformStats(raw, period)
  },

  async users(
    filters: { search?: string; role?: UserRole | 'all'; status?: UserStatus | 'all'; page?: number } = {},
  ): Promise<AdminUserRow[]> {
    const { search = '', role = 'all', status = 'all', page = 1 } = filters
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '100')
    if (search) params.set('search', search)
    if (role !== 'all') params.set('role', ROLE_TO_WIRE[role])
    // `account_status` is the only status the backend can filter on; "invited"
    // is derived from `is_verified` after the rows come back, so it is applied
    // client-side below rather than sent as a value the server would reject.
    if (status === 'active' || status === 'suspended') params.set('status', status)
    const raw = await httpGet<BackendUserList>(`${A('/users')}?${params.toString()}`)
    const rows = raw.users.map(toUserRow)
    return status === 'invited' ? rows.filter((row) => row.status === 'invited') : rows
  },

  setRole: (id: string, role: UserRole): Promise<void> =>
    // The backend schema is `newRole`; sending `role` is silently stripped and
    // fails validation (backend/src/modules/admin/zodschemas/admin.zschema.ts).
    httpPatch(A(`/users/${id}/role`), { newRole: ROLE_TO_WIRE[role] }),

  setStatus: (id: string, status: UserStatus): Promise<void> =>
    status === 'suspended'
      ? httpPost(A(`/users/${id}/suspend`), {})
      : httpPost(A(`/users/${id}/reinstate`), {}),

  suspend: (id: string, reason?: string): Promise<void> =>
    httpPost(A(`/users/${id}/suspend`), reason ? { reason } : {}),

  reinstate: (id: string): Promise<void> => httpPost(A(`/users/${id}/reinstate`), {}),
}
