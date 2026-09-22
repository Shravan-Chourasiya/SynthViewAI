import { z } from "zod";

/** POST /interviews/:id/share and /share/revoke — the interview id param. */
export const interviewIdParamSchema = z.object({
  id: z.string().uuid(),
});

/** POST /interviews/:id/share/revoke — the body carries the token to revoke. */
export const revokeShareSchema = z.object({
  token: z.string().min(1).max(2048),
});

/** GET /interviews/shared/:token — the token is a route param. JWTs are
 * compact and bounded (~1–2 KB), so 2048 is a generous ceiling that still
 * rejects garbage before it reaches the verify call. */
export const shareTokenParamSchema = z.object({
  token: z.string().min(1).max(2048),
});
