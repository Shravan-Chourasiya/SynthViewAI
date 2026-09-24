import * as z from "zod";
import { userRegex } from "../../../lib/zod/user.zschema.js";

/**
 * POST /contact — the public contact form.
 *
 * The schema validates and trims; whitespace collapsing and control-character
 * stripping happen in the service, because those rules exist to protect the
 * mail headers and belong next to the send call.
 */
export const contactSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(80, { message: "Name must be at most 80 characters" }),
  email: z
    .string()
    .trim()
    .regex(userRegex.emailRegex, { message: "Invalid email format" })
    .max(180, { message: "Email must be at most 180 characters" }),
  subject: z
    .string()
    .trim()
    .min(3, { message: "Subject must be at least 3 characters" })
    .max(120, { message: "Subject must be at most 120 characters" }),
  message: z
    .string()
    .trim()
    .min(20, { message: "Message must be at least 20 characters" })
    .max(2000, { message: "Message must be at most 2000 characters" }),
});

export type ContactSubmission = z.output<typeof contactSubmissionSchema>;
