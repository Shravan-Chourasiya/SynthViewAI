import { create } from 'zustand'
import { authService } from '../services/auth'
import { ApiError, setOnAuthExpired } from '../http'
import type { MeResponse } from '../api-types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  user: MeResponse | null
  status: AuthStatus
  pendingEmail: string | null
  error: string | null
}

interface AuthActions {
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (name: string, username: string, email: string, password: string) => Promise<void>
  verifyOtp: (email: string, otp: string) => Promise<void>
  logout: () => Promise<void>
  signOut: () => Promise<void>
  forceLogout: (message?: string) => void
  setPendingEmail: (email: string | null) => void
  patchUser: (patch: Partial<MeResponse>) => void
  /** Persists the editable profile fields through `PATCH /usr/profile`. */
  updateProfile: (patch: { firstName?: string; lastName?: string; username?: string }) => Promise<void>
  _clear: () => void
}

let bootstrapRequest: Promise<void> | null = null

/** Derives display-friendly `name` and `role` from raw backend fields. */
function deriveName(user: MeResponse): MeResponse {
  const parts = [user.firstName, user.lastName].filter(Boolean)
  return {
    ...user,
    name: user.name || (parts.length > 0 ? parts.join(' ') : user.username),
    role: user.role || user.userrole,
    joinedAt: user.joinedAt || user.createdAt,
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState & AuthActions>((set, get) => {
  setOnAuthExpired(() => {
    get().forceLogout('Your session expired. Please sign in again.')
  })

  return {
    user: null,
    status: 'idle',
    pendingEmail: null,
    error: null,

    // ── bootstrap ─────────────────────────────────────────────────────────────
    async bootstrap() {
      if (bootstrapRequest) return bootstrapRequest
      bootstrapRequest = (async () => {
        set({ status: 'loading', error: null })
        try {
          const raw = await authService.me()
          set({ user: deriveName(raw), status: 'authenticated', error: null })
        } catch (err) {
          const apiErr = err instanceof ApiError ? err : undefined
          set({
            user: null,
            status: 'unauthenticated',
            error: apiErr?.status === 401 ? null : (apiErr?.message ?? null),
          })
        } finally {
          bootstrapRequest = null
        }
      })()
      return bootstrapRequest
    },

    // ── login ─────────────────────────────────────────────────────────────────
    async login(email, password) {
      set({ status: 'loading', error: null })
      try {
        const raw = await authService.login({ email, password, deviceType: 'desktop' })
        set({ user: deriveName(raw), status: 'authenticated', error: null, pendingEmail: null })
      } catch (err) {
        set({
          status: 'unauthenticated',
          error: err instanceof Error ? err.message : 'Unable to sign in.',
        })
        throw err
      }
    },

    // ── register ──────────────────────────────────────────────────────────────
    async register(name, username, email, password) {
      set({ error: null })
      const [firstName, ...rest] = name.trim().split(/\s+/)
      await authService.register({
        email,
        password,
        username,
        firstName,
        ...(rest.length > 0 ? { lastName: rest.join(' ') } : {}),
      })
      set({ pendingEmail: email })
    },

    // ── verifyOtp ─────────────────────────────────────────────────────────────
    async verifyOtp(email, otp) {
      set({ error: null })
      await authService.verifyOtp({ email, otp })
      set({ pendingEmail: null })
    },

    // ── logout ────────────────────────────────────────────────────────────────
    async logout() {
      try {
        await authService.logout()
      } catch {
        // swallow — clear state unconditionally
      } finally {
        get()._clear()
      }
    },

    async signOut() {
      return get().logout()
    },

    // ── forceLogout ───────────────────────────────────────────────────────────
    forceLogout(message?: string) {
      set({ user: null, pendingEmail: null, status: 'unauthenticated', error: message ?? null })
      if (typeof window !== 'undefined') window.location.replace('/login')
    },

    // ── _clear ────────────────────────────────────────────────────────────────
    _clear() {
      set({ user: null, pendingEmail: null, status: 'unauthenticated', error: null })
    },

    setPendingEmail: (email) => set({ pendingEmail: email }),

    patchUser(patch) {
      const current = get().user
      if (current) set({ user: deriveName({ ...current, ...patch }) })
    },

    async updateProfile(patch) {
      // Server first: a local-only edit would claim success and lose the change
      // on the next `bootstrap()`.
      const updated = await authService.updateProfile(patch)
      set({ user: deriveName(updated) })
    },
  }
})

export const useCurrentUser = () => useAuthStore((s) => s.user)
