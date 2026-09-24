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
// Applies to every auth cookie, and only when COOKIE_DOMAIN is actually set.
//
// When production puts the frontend and the API on one registrable domain
// (app.example.com + api.example.com), the CSRF cookie needs `Domain=.example.com`:
// the frontend reads it through `document.cookie` to fill the `X-CSRF-Token`
// header, and a host-only cookie written by the API host is invisible to every
// other origin — so the header would never be sent and every mutating request
// would 403. `res.clearCookie` only deletes a cookie whose attributes match the
// ones it was set with, which is why this lives here and not in the controller.
//
// Left unset (local development, and any deployment where the two apps sit on
// unrelated hosts) the cookies stay host-only — today's behaviour, unchanged.
// Never point this at a public suffix such as `.onrender.com`: browsers reject
// those cookies outright.
const cookieDomain = process.env.COOKIE_DOMAIN?.trim();
const domainAttr = cookieDomain ? { domain: cookieDomain } : {};

export const COOKIE_CONFIG = {
  ACCESS: {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE.ACCESS,
    ...domainAttr,
  },
  REFRESH: {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE.REFRESH,
    ...domainAttr,
  },
  DEVICE_ID: {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE.DEVICE_ID,
    ...domainAttr,
  },
  CSRF: {
    httpOnly: false,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE.REFRESH,
    ...domainAttr,
  },
};
