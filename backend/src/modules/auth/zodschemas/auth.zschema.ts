import * as z from "zod";
import { userRegex } from "../../../lib/zod/user.zschema.js";

export const registerSchema = z.object({
  email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
  password: z.string().regex(userRegex.passwordRegex, {
    message:
      "Password must be at least 8 characters long and contain at least one letter and one number",
  }),
  username: z.string().regex(userRegex.usernameRegex, {
    message:
      "Username must be 3-30 characters long and can only contain letters, numbers, and underscores",
  }),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

export const verifyOtpSchema = z.object({
  email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
  otp: z
    .string()
    .length(6, { message: "OTP must be exactly 6 digits" })
    .regex(/^\d{6}$/, { message: "OTP must contain only digits" }),
});

export const loginSchema = z.object({
  email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
  password: z.string().min(1, { message: "Password is required" }),
  deviceType: z.enum(["desktop", "mobile", "tablet"]).default("desktop"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
});

export const forgotPasswordOtpVerifySchema = z
  .object({
    email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
    otp: z
      .string()
      .length(6, { message: "OTP must be exactly 6 digits" })
      .regex(/^\d{6}$/, { message: "OTP must contain only digits" }),
    newPassword: z.string().regex(userRegex.passwordRegex, {
      message:
        "Password must be at least 8 characters long and contain at least one letter and one number",
    }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const updatePasswordSchema = z
  .object({
    email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
    currentPassword: z.string().min(1, { message: "Current password is required" }),
    newPassword: z.string().regex(userRegex.passwordRegex, {
      message:
        "New password must be at least 8 characters long and contain at least one letter and one number",
    }),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "New password cannot be the same as the current password",
  });

export const updateEmailSchema = z.object({
  email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
});

export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    username: z.string().regex(userRegex.usernameRegex, {
      message:
        "Username must be 3-30 characters long and can only contain letters, numbers, and underscores",
    }).optional(),
  })
  .refine(
    (data) =>
      data.firstName !== undefined || data.lastName !== undefined || data.username !== undefined,
    {
      message: "At least one profile field is required",
    },
  );

export const emailUpdateOtpVerifySchema = z.object({
  email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
  otp: z
    .string()
    .length(6, { message: "OTP must be exactly 6 digits" })
    .regex(/^\d{6}$/, { message: "OTP must contain only digits" }),
});

export const recoverAccountOtpSchema = z.object({
  email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
  otp: z
    .string()
    .length(6, { message: "OTP must be exactly 6 digits" })
    .regex(/^\d{6}$/, { message: "OTP must contain only digits" }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ForgotPasswordOtpVerifyInput = z.infer<typeof forgotPasswordOtpVerifySchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type EmailUpdateOtpVerifyInput = z.infer<typeof emailUpdateOtpVerifySchema>;
export type RecoverAccountOtpInput = z.infer<typeof recoverAccountOtpSchema>;
