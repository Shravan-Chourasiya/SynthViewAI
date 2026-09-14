import * as z from "zod";
import type { UserType } from "../../types/schemas/userschema.type.js";

export const userRegex = {
  emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // Symbols are valid password characters; only whitespace is rejected.
  // This matches the registration UI: 8+ chars, a letter, and a number.
  passwordRegex: /^(?=.*[A-Za-z])(?=.*\d)\S{8,}$/,
  usernameRegex: /^[a-zA-Z0-9_]{3,30}$/,
};

export const userSchema: z.ZodType<UserType> = z.object({
  // User Base fields
  id: z.string().uuid({ message: "Invalid UUID format" }),
  email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
  password: z.string().regex(userRegex.passwordRegex, {
    message:
      "Password must be at least 8 characters long and contain at least one letter and one number",
  }),
  username: z.string().regex(userRegex.usernameRegex, {
    message:
      "Username must be 3-30 characters long and can only contain letters, numbers, and underscores",
  }),

  // User Account fields
  isVerified: z.boolean().default(false),
  accountStatus: z.enum(["active", "suspended", "disabled", "deleted"]).default("active"),
  oauthProvider: z.enum(["google", "facebook", "github", "none"]).default("none"),
  isOauthEnabled: z.boolean().default(false),

  // User Profile fields
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  bio: z.string().optional(),
  organisation: z.string().optional(),
  country: z.string().optional(),

  // 2FA fields
  twoFAtype: z.enum(["none", "sms", "authenticator"]).default("none"),
  twoFAStatus: z.enum(["enabled", "disabled"]).default("disabled"),
  twoFASecret: z.string().optional(),
  twoFARecoveryCodes: z.array(z.string()).optional(),
  twoFAEnabledOptions: z
    .object({
      sms: z.boolean().default(false),
      authenticator: z.boolean().default(false),
      email: z.boolean().default(false),
    })
    .optional(),

  // External Models Related fields
  interviewCount: z.number().int().default(0),
  subscriptionPlan: z.enum(["free", "premium", "enterprise"]).default("free"),
  sessionCount: z
    .number()
    .int()
    .max(5, { message: "Maximum of 5 active sessions allowed" })
    .default(0),

  // Timestamps
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
