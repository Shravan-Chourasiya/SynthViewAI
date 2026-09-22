import { z } from "zod";

/** GET /notifications — pagination + unread filter. */
export const notificationListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => {
      const num = Number(val);
      return isNaN(num) || num < 1 ? 1 : num;
    }),
  limit: z
    .string()
    .optional()
    .default("20")
    .transform((val) => {
      const num = Number(val);
      return isNaN(num) || num < 1 || num > 100 ? 20 : Math.min(Math.max(num, 1), 100);
    }),
  unreadOnly: z
    .string()
    .optional()
    .default("false")
    .transform((val) => val === "true"),
});

/** PATCH /notifications/:id/read — the id is a route param. */
export const notificationIdParamSchema = z.object({
  id: z.string().uuid(),
});
