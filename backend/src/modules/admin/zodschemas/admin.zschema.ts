import { z } from "zod";

/** A `YYYY-MM-DD` bound, which is what `<input type="date">` sends. */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses an inclusive date-range bound from a query string.
 *
 * `bound` decides what a date-only value means. A date input has day precision,
 * so a bare `2026-09-05` is midnight — for the lower bound that is exactly right,
 * but for the upper bound it would exclude the whole of the 5th, which is never
 * what "from the 1st to the 5th" means to the person who picked it. The upper
 * bound therefore becomes the start of the following day, and the query compares
 * with `<` (see admin.service.ts).
 *
 * An unparseable value yields `undefined` rather than throwing: a hand-typed
 * query string should narrow nothing, not 400 the whole page.
 */
function dateBoundSchema(bound: "start" | "end") {
  return z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const dateOnly = DATE_ONLY_PATTERN.test(val);
      const parsed = new Date(dateOnly ? `${val}T00:00:00.000Z` : val);
      if (Number.isNaN(parsed.getTime())) return undefined;
      if (bound === "end" && dateOnly) {
        return new Date(parsed.getTime() + 24 * 60 * 60 * 1000);
      }
      return parsed;
    });
}

// User listing filters
export const userListQuerySchema = z.object({
  page: z.string().optional().default('1').transform((val) => {
    const num = Number(val);
    return isNaN(num) || num < 1 ? 1 : num;
  }),
  limit: z.string().optional().default('10').transform((val) => {
    const num = Number(val);
    return isNaN(num) || num < 1 || num > 100 ? 10 : Math.min(Math.max(num, 1), 100);
  }),
  search: z.string().optional().default('').transform((val) => val.trim()),
  role: z.enum(['user', 'admin', 'moderator', 'owner']).optional(),
  sortBy: z.enum(['createdAt', 'email', 'firstName', 'lastName', 'userrole']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Update user role
export const updateUserRoleSchema = z.object({
  newRole: z.enum(['user', 'admin', 'moderator', 'owner']),
});

// User suspension/reinstatement
export const suspendUserSchema = z.object({
  reason: z.string().optional().default('Administrative action'),
});

// Interview listing filters
export const interviewListQuerySchema = z.object({
  page: z.string().optional().default('1').transform((val) => {
    const num = Number(val);
    return isNaN(num) || num < 1 ? 1 : num;
  }),
  limit: z.string().optional().default('10').transform((val) => {
    const num = Number(val);
    return isNaN(num) || num < 1 || num > 100 ? 10 : Math.min(Math.max(num, 1), 100);
  }),
  // Free-text search over the interview title and the owning user (name/email).
  // A lookup key only: the response carries an anonymized candidate reference,
  // never the identity that was searched for.
  search: z.string().optional().default('').transform((val) => val.trim()),
  status: z.enum(['DRAFT', 'READY', 'SCHEDULED', 'INPROGRESS', 'COMPLETED', 'CANCELLED', 'ABANDONED', 'EXPIRED', 'TIMED_OUT']).optional(),
  userId: z.string().optional(),
  // Session configuration filters, read from the interview metadata jsonb.
  jobRole: z.string().optional().transform((val) => val?.trim()),
  company: z.string().optional().transform((val) => val?.trim()),
  // Date range on `createdAt`. Accepts `YYYY-MM-DD` (what a date input sends) or
  // a full ISO timestamp.
  from: dateBoundSchema("start"),
  to: dateBoundSchema("end"),
  sortBy: z.enum(['createdAt', 'updatedAt', 'status', 'title']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Admin overview query
export const adminOverviewQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).optional().default('30d'),
});