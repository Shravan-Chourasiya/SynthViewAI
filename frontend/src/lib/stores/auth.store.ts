import { create } from "zustand";
import * as authSvc from "../services/auth.service";
import { ApiError, setOnAuthExpired } from "../http";
import type { MeResponse } from "../types/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthStatus =
  | "idle"
  | "loading"
  | "authenticated"
  | "unauthenticated";

interface AuthState {
  user: MeResponse | null;
  pendingEmail: string | null;
  status: AuthStatus;
  error: string | null;
}

let bootstrapRequest: Promise<void> | null = null;

interface AuthActions {
  bootstrap: () => Promise<void>;
  login: (
    email: string,
    password: string,
    deviceType?: "desktop" | "mobile" | "tablet",
  ) => Promise<void>;
  register: (name: string, username: string, email: string, password: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  _clear: () => void;
  setPendingEmail: (email: string | null) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState & AuthActions>((set, get) => {
  // Wire the http.ts onAuthExpired callback once at store creation time.
  // When a silent refresh fails anywhere in the app, this clears auth state.
  setOnAuthExpired(() => get()._clear());

  return {
    user: null,
    pendingEmail: null,
    status: "idle",
    error: null,

    // ── bootstrap ─────────────────────────────────────────────────────────────
    // Called once on app start. Determines whether a valid session cookie exists.
    // Never throws — a 401 is treated as "not logged in", not an error.
    async bootstrap() {
      if (bootstrapRequest) return bootstrapRequest;
      bootstrapRequest = (async () => {
        set({ status: "loading", error: null });
        try {
          const user = await authSvc.me();
          set({ user, status: "authenticated", error: null });
        } catch (error) {
          set({
            user: null,
            status: "unauthenticated",
            error:
              error instanceof ApiError && error.status !== 401
                ? error.message
                : null,
          });
        } finally {
          bootstrapRequest = null;
        }
      })();
      return bootstrapRequest;
    },

    // ── login ─────────────────────────────────────────────────────────────────
    async login(email, password, deviceType = "desktop") {
      set({ status: "loading", error: null });
      try {
        await authSvc.login({ email, password, deviceType });
        const user = await authSvc.me();
        set({ user, status: "authenticated", error: null });
      } catch (error) {
        set({
          status: "unauthenticated",
          error: error instanceof Error ? error.message : "Unable to sign in.",
        });
        throw error;
      }
    },

    // ── register ──────────────────────────────────────────────────────────────
    // Does NOT log the user in — OTP verification is required first.
    async register(name, username, email, password) {
      set({ error: null });
      const [firstName, ...rest] = name.trim().split(/\s+/);
      await authSvc.register({
        email,
        password,
        username,
        firstName,
        ...(rest.length > 0 ? { lastName: rest.join(" ") } : {}),
      });
      set({ pendingEmail: email });
    },

    // ── verifyOtp ─────────────────────────────────────────────────────────────
    // Backend verifyOtpController returns data: null and sets NO cookies.
    // Account is now verified; user must log in separately.
    async verifyOtp(email, otp) {
      set({ error: null });
      await authSvc.verifyOtp({ email, otp });
      // No auto-login — route to /login after this resolves
    },

    // ── logout ────────────────────────────────────────────────────────────────
    // Clears client state regardless of whether the network call succeeds.
    async logout() {
      try {
        await authSvc.logout();
      } catch {
        // Swallow — we clear state unconditionally below
      } finally {
        get()._clear();
      }
    },

    // ── _clear ────────────────────────────────────────────────────────────────
    // Internal: reset to unauthenticated. Called by logout and onAuthExpired.
    _clear() {
      set({
        user: null,
        pendingEmail: null,
        status: "unauthenticated",
        error: null,
      });
    },

    // ── setPendingEmail ───────────────────────────────────────────────────────
    // Public method to set pending email for verification
    setPendingEmail(email: string | null) {
      set({ pendingEmail: email });
    },
  };
});
