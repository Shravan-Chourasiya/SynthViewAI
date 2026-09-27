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

// ── SameSite policy ───────────────────────────────────────────────────────────
// The deployed frontend (*.vercel.app) and the API (*.onrender.com) are different
// sites, so every auth cookie rides a cross-site request. Browsers drop a
// `SameSite=Lax` cookie from a cross-site response outright — login answers 200,
// `Set-Cookie` goes out for all four cookies, and the browser keeps none of them,
// so the very next `GET /usr/me` arrives with no session and 401s. That is the
// exact "correct credentials → invalid credentials" loop in production.
//
// `SameSite=None` is the mode that works across unrelated origins, and browsers
// reject it unless the cookie is also `Secure` — hence why the two are derived
// together below. Same-site (`lax`) is the stronger setting, so deployments where
// frontend and API share one registrable domain should set COOKIE_SAME_SITE=lax
// (or COOKIE_DOMAIN to share the cookie across subdomains).
function parseSameSite(raw: string | undefined): "lax" | "strict" | "none" | undefined {
  const value = raw?.trim().toLowerCase();
  if (value === "lax" || value === "strict" || value === "none") return value;
  if (value) {
    // Fail loud: a typo would silently fall back to a policy that breaks login.
    throw new Error(`COOKIE_SAME_SITE must be one of lax|strict|none, received "${raw}"`);
  }
  return undefined;
}

const cookieSameSite: "lax" | "strict" | "none" =
  parseSameSite(process.env.COOKIE_SAME_SITE) ??
  (process.env.NODE_ENV === "production" ? "none" : "lax");
const secureCookie = process.env.NODE_ENV !== "development" || cookieSameSite === "none";

const cookieAttrs = {
  secure: secureCookie,
  sameSite: cookieSameSite,
  ...domainAttr,
};

export const COOKIE_CONFIG = {
  ACCESS: {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE.ACCESS,
    ...cookieAttrs,
  },
  REFRESH: {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE.REFRESH,
    ...cookieAttrs,
  },
  DEVICE_ID: {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE.DEVICE_ID,
    ...cookieAttrs,
  },
  CSRF: {
    httpOnly: false,
    maxAge: COOKIE_MAX_AGE.REFRESH,
    ...cookieAttrs,
  },
};
