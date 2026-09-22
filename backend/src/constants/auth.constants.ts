// ── Bcrypt ────────────────────────────────────────────────────────────────────
export const SALT_ROUNDS = 12;

// ── OTP Purposes ──────────────────────────────────────────────────────────────
export const OTP_PURPOSE = {
  REGISTER: "registration",
  FORGOT_PASSWORD: "forgot_password",
  RECOVER_ACCOUNT: "recover_account",
  UPDATE_EMAIL: "update_email",
} as const;

// ── Session ───────────────────────────────────────────────────────────────────
export const MAX_SESSIONS = 5;
export const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const ACCOUNT_RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── JWT ───────────────────────────────────────────────────────────────────────
export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "30d";
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

// ── Report share links ────────────────────────────────────────────────────────
// A share token is a short-lived signed JWT of type "share". Seven days
// balances "the mentor will get to it eventually" against a window small
// enough that a leaked link ages out on its own; revocation is available via
// POST /interviews/:id/share/revoke (Redis blacklist).
export const SHARE_TOKEN_TTL = "7d";
export const SHARE_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

// ── Cookie Names ──────────────────────────────────────────────────────────────
export const COOKIE_NAMES = {
  ACCESS: "access_token",
  REFRESH: "refresh_token",
  CSRF: "csrf_token",
  DEVICE_ID: "device_id",
} as const;

// ── Cookie Max Ages (ms) ──────────────────────────────────────────────────────
export const COOKIE_MAX_AGE = {
  ACCESS: 15 * 60 * 1000, // 15 minutes
  REFRESH: 30 * 24 * 60 * 60 * 1000, // 30 days
  DEVICE_ID: 30 * 24 * 60 * 60 * 1000, // 30 days
  CSRF: 30 * 24 * 60 * 60 * 1000, // 30 days
} as const;

// ── Cookie Configurations ──────────────────────────────────────────────────────
export const COOKIE_CONFIG = {
  ACCESS: {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE.ACCESS,
  },
  REFRESH: {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE.REFRESH,
  },
  DEVICE_ID: {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE.DEVICE_ID,
  },
  CSRF: {
    httpOnly: false,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE.REFRESH,
  },
};
