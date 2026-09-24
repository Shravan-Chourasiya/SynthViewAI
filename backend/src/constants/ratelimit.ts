/**
 * Rate limit configurations for all route types.
 * windowMs — sliding window duration in milliseconds
 * limit    — max requests allowed per window per IP
 */
export const RateLimits = {
  /** General API — broad protection for all routes */
  GLOBAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 200,
  },

  /** Auth routes — register, login, logout */
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 20,
  },

  /** OTP verification — tighter to prevent brute force */
  OTP_VERIFY: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    limit: 5,
  },

  /** OTP resend — prevent OTP spam */
  OTP_RESEND: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    limit: 3,
  },

  /** Password reset request */
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 5,
  },

  /** Interview creation and management */
  INTERVIEW: {
    windowMs: 1 * 60 * 1000, // 1 min
    limit: 50,
  },
  CREATE_INTERVIEW: {
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 10,
  },

  /** AI-powered endpoints — expensive, tightly limited */
  AI: {
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 20,
  },

  /** Public share-link reads — unauthenticated, so stricter than the
   * authenticated interview routes (token guessing surface). */
  SHARE: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 30,
  },

  /** Public contact form — each hit sends two emails, so keep it tight enough
   * that the form cannot be used to burn the mail quota or spam a stranger's
   * inbox with acknowledgements. */
  CONTACT: {
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 5,
  },
} as const;

export type RateLimitKey = keyof typeof RateLimits;
