/**
 * unit.schemas.test.ts — Part 1.4
 * Zod schema unit tests for all mutating route schemas.
 * No DB, no Redis.
 *
 * Strip behavior: Zod strips unknown fields by default (not strict).
 * This is confirmed and tested explicitly below.
 */
import { describe, it, expect } from "vitest";
import {
  registerSchema,
  verifyOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  forgotPasswordOtpVerifySchema,
  updatePasswordSchema,
  updateEmailSchema,
  emailUpdateOtpVerifySchema,
  recoverAccountOtpSchema,
} from "../src/modules/auth/zodschemas/auth.zschema.js";
import { createInterviewSchema } from "../src/modules/interview/zodschemas/interview.zschema.js";
import { userListQuerySchema } from "../src/modules/admin/zodschemas/admin.zschema.js";

// ── registerSchema ────────────────────────────────────────────────────────────

describe("registerSchema", () => {
  const valid = { email: "user@example.com", password: "Password1", username: "john_doe" };

  it("accepts valid input", () => expect(registerSchema.safeParse(valid).success).toBe(true));
  it("accepts optional firstName and lastName", () => {
    expect(registerSchema.safeParse({ ...valid, firstName: "John", lastName: "Doe" }).success).toBe(
      true,
    );
  });
  it("rejects invalid email", () =>
    expect(registerSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false));
  it("rejects email with spaces", () =>
    expect(registerSchema.safeParse({ ...valid, email: "user @example.com" }).success).toBe(false));
  it("rejects password without a number", () =>
    expect(registerSchema.safeParse({ ...valid, password: "PasswordOnly" }).success).toBe(false));
  it("rejects password shorter than 8 characters", () =>
    expect(registerSchema.safeParse({ ...valid, password: "Pass1" }).success).toBe(false));
  it("rejects username shorter than 3 characters", () =>
    expect(registerSchema.safeParse({ ...valid, username: "ab" }).success).toBe(false));
  it("rejects username longer than 30 characters", () =>
    expect(registerSchema.safeParse({ ...valid, username: "a".repeat(31) }).success).toBe(false));
  it("rejects username with spaces", () =>
    expect(registerSchema.safeParse({ ...valid, username: "john doe" }).success).toBe(false));
  it("rejects username with special characters", () =>
    expect(registerSchema.safeParse({ ...valid, username: "john!" }).success).toBe(false));
  it("rejects firstName longer than 100 characters", () =>
    expect(registerSchema.safeParse({ ...valid, firstName: "a".repeat(101) }).success).toBe(false));
  it("rejects missing email", () =>
    expect(
      registerSchema.safeParse({ password: valid.password, username: valid.username }).success,
    ).toBe(false));
  it("rejects missing password", () =>
    expect(registerSchema.safeParse({ email: valid.email, username: valid.username }).success).toBe(
      false,
    ));
  it("rejects missing username", () =>
    expect(registerSchema.safeParse({ email: valid.email, password: valid.password }).success).toBe(
      false,
    ));
  it("strips unknown fields (default Zod behavior — not strict)", () => {
    const result = registerSchema.safeParse({ ...valid, unknownField: "should-be-stripped" });
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).unknownField).toBeUndefined();
  });
});

// ── verifyOtpSchema ───────────────────────────────────────────────────────────

describe("verifyOtpSchema", () => {
  const valid = { email: "user@example.com", otp: "123456" };

  it("accepts valid input", () => expect(verifyOtpSchema.safeParse(valid).success).toBe(true));
  it("rejects OTP shorter than 6 digits", () =>
    expect(verifyOtpSchema.safeParse({ ...valid, otp: "12345" }).success).toBe(false));
  it("rejects OTP longer than 6 digits", () =>
    expect(verifyOtpSchema.safeParse({ ...valid, otp: "1234567" }).success).toBe(false));
  it("rejects OTP with letters", () =>
    expect(verifyOtpSchema.safeParse({ ...valid, otp: "12345a" }).success).toBe(false));
  it("rejects OTP with spaces", () =>
    expect(verifyOtpSchema.safeParse({ ...valid, otp: "12 456" }).success).toBe(false));
  it("rejects missing otp", () =>
    expect(verifyOtpSchema.safeParse({ email: valid.email }).success).toBe(false));
  it("rejects missing email", () =>
    expect(verifyOtpSchema.safeParse({ otp: valid.otp }).success).toBe(false));
});

// ── loginSchema ───────────────────────────────────────────────────────────────

describe("loginSchema", () => {
  const valid = {
    email: "user@example.com",
    password: "Password1",
    deviceType: "desktop" as const,
  };

  it("accepts valid input", () => expect(loginSchema.safeParse(valid).success).toBe(true));
  it("defaults deviceType to 'desktop' when omitted", () => {
    const result = loginSchema.safeParse({ email: valid.email, password: valid.password });
    expect(result.success).toBe(true);
    expect(result.data?.deviceType).toBe("desktop");
  });
  it("accepts mobile deviceType", () =>
    expect(loginSchema.safeParse({ ...valid, deviceType: "mobile" }).success).toBe(true));
  it("rejects unknown deviceType", () =>
    expect(loginSchema.safeParse({ ...valid, deviceType: "smartwatch" }).success).toBe(false));
  it("rejects empty password", () =>
    expect(loginSchema.safeParse({ ...valid, password: "" }).success).toBe(false));
  it("rejects missing email", () =>
    expect(loginSchema.safeParse({ password: valid.password }).success).toBe(false));
});

// ── forgotPasswordSchema ──────────────────────────────────────────────────────

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () =>
    expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true));
  it("rejects invalid email", () =>
    expect(forgotPasswordSchema.safeParse({ email: "bad" }).success).toBe(false));
  it("rejects missing email", () => expect(forgotPasswordSchema.safeParse({}).success).toBe(false));
});

// ── forgotPasswordOtpVerifySchema ─────────────────────────────────────────────

describe("forgotPasswordOtpVerifySchema", () => {
  const valid = {
    email: "user@example.com",
    otp: "123456",
    newPassword: "NewPass1",
    confirmPassword: "NewPass1",
  };

  it("accepts valid input", () =>
    expect(forgotPasswordOtpVerifySchema.safeParse(valid).success).toBe(true));
  it("rejects when passwords do not match", () => {
    expect(
      forgotPasswordOtpVerifySchema.safeParse({ ...valid, confirmPassword: "Different1" }).success,
    ).toBe(false);
  });
  it("rejects weak newPassword", () =>
    expect(
      forgotPasswordOtpVerifySchema.safeParse({
        ...valid,
        newPassword: "weak",
        confirmPassword: "weak",
      }).success,
    ).toBe(false));
  it("rejects missing confirmPassword", () =>
    expect(
      forgotPasswordOtpVerifySchema.safeParse({
        email: valid.email,
        otp: valid.otp,
        newPassword: valid.newPassword,
      }).success,
    ).toBe(false));
});

// ── updatePasswordSchema ──────────────────────────────────────────────────────

describe("updatePasswordSchema", () => {
  const valid = { email: "user@example.com", currentPassword: "OldPass1", newPassword: "NewPass1" };

  it("accepts valid input", () => expect(updatePasswordSchema.safeParse(valid).success).toBe(true));
  it("rejects when newPassword equals currentPassword", () => {
    expect(updatePasswordSchema.safeParse({ ...valid, newPassword: "OldPass1" }).success).toBe(
      false,
    );
  });
  it("rejects empty currentPassword", () =>
    expect(updatePasswordSchema.safeParse({ ...valid, currentPassword: "" }).success).toBe(false));
  it("rejects weak newPassword", () =>
    expect(updatePasswordSchema.safeParse({ ...valid, newPassword: "weak" }).success).toBe(false));
});

// ── updateEmailSchema ─────────────────────────────────────────────────────────

describe("updateEmailSchema", () => {
  it("accepts valid email", () =>
    expect(updateEmailSchema.safeParse({ email: "new@example.com" }).success).toBe(true));
  it("rejects invalid email", () =>
    expect(updateEmailSchema.safeParse({ email: "not-email" }).success).toBe(false));
  it("rejects missing email", () => expect(updateEmailSchema.safeParse({}).success).toBe(false));
});

// ── emailUpdateOtpVerifySchema ────────────────────────────────────────────────

describe("emailUpdateOtpVerifySchema", () => {
  const valid = { email: "user@example.com", otp: "654321" };

  it("accepts valid input", () =>
    expect(emailUpdateOtpVerifySchema.safeParse(valid).success).toBe(true));
  it("rejects non-digit OTP", () =>
    expect(emailUpdateOtpVerifySchema.safeParse({ ...valid, otp: "abc123" }).success).toBe(false));
  it("rejects OTP of wrong length", () =>
    expect(emailUpdateOtpVerifySchema.safeParse({ ...valid, otp: "12345" }).success).toBe(false));
});

// ── recoverAccountOtpSchema ───────────────────────────────────────────────────

describe("recoverAccountOtpSchema", () => {
  const valid = { email: "user@example.com", otp: "111222" };

  it("accepts valid input", () =>
    expect(recoverAccountOtpSchema.safeParse(valid).success).toBe(true));
  it("rejects non-digit OTP", () =>
    expect(recoverAccountOtpSchema.safeParse({ ...valid, otp: "aabbcc" }).success).toBe(false));
  it("rejects missing fields", () =>
    expect(recoverAccountOtpSchema.safeParse({}).success).toBe(false));
});

// ── createInterviewSchema ─────────────────────────────────────────────────────

describe("createInterviewSchema", () => {
  const valid = {
    jobrole: "Software Engineer",
    experience: "junior" as const,
    interviewStyle: "FAANG" as const,
    interviewType: "MIXED" as const,
    duration: 30,
    isScheduled: false,
  };

  it("accepts valid input", () =>
    expect(createInterviewSchema.safeParse(valid).success).toBe(true));
  it("defaults experience to 'fresher'", () => {
    const result = createInterviewSchema.safeParse({ ...valid, experience: undefined });
    expect(result.success).toBe(true);
    expect(result.data?.experience).toBe("fresher");
  });
  it("defaults interviewStyle to 'FAANG'", () => {
    const result = createInterviewSchema.safeParse({ ...valid, interviewStyle: undefined });
    expect(result.success).toBe(true);
    expect(result.data?.interviewStyle).toBe("FAANG");
  });
  it("defaults interviewType to 'MIXED'", () => {
    const result = createInterviewSchema.safeParse({ ...valid, interviewType: undefined });
    expect(result.success).toBe(true);
    expect(result.data?.interviewType).toBe("MIXED");
  });
  it("rejects jobrole longer than 60 characters", () => {
    expect(createInterviewSchema.safeParse({ ...valid, jobrole: "a".repeat(61) }).success).toBe(
      false,
    );
  });
  it("rejects invalid interviewStyle", () => {
    expect(createInterviewSchema.safeParse({ ...valid, interviewStyle: "GOOGLE" }).success).toBe(
      false,
    );
  });
  it("rejects invalid interviewType", () => {
    expect(createInterviewSchema.safeParse({ ...valid, interviewType: "CODING" }).success).toBe(
      false,
    );
  });
  it("rejects negative duration", () => {
    expect(createInterviewSchema.safeParse({ ...valid, duration: -1 }).success).toBe(false);
  });
  it("rejects zero duration", () => {
    expect(createInterviewSchema.safeParse({ ...valid, duration: 0 }).success).toBe(false);
  });
  it("rejects missing jobrole", () => {
    expect(createInterviewSchema.safeParse({ ...valid, jobrole: undefined }).success).toBe(false);
  });
  it("strips unknown fields", () => {
    const result = createInterviewSchema.safeParse({ ...valid, unknownField: "x" });
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).unknownField).toBeUndefined();
  });
});

// ── userListQuerySchema ────────────────────────────────────────────────────────
// Query strings, so every value arrives as a string. `status` is the account
// state filter the admin console sends; there is no `invited` value because
// that badge is derived from `is_verified` on the client.

describe("userListQuerySchema", () => {
  it("applies pagination, search and sort defaults", () => {
    const parsed = userListQuerySchema.parse({});
    expect(parsed).toEqual({
      page: 1,
      limit: 10,
      search: "",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("accepts an account_status filter value", () => {
    const parsed = userListQuerySchema.parse({ status: "suspended" });
    expect(parsed.status).toBe("suspended");
    expect(userListQuerySchema.parse({ status: "active" }).status).toBe("active");
    expect(userListQuerySchema.parse({ status: "disabled" }).status).toBe("disabled");
    expect(userListQuerySchema.parse({ status: "deleted" }).status).toBe("deleted");
  });

  it("rejects a status the account_status enum does not have", () => {
    expect(userListQuerySchema.safeParse({ status: "invited" }).success).toBe(false);
    expect(userListQuerySchema.safeParse({ status: "INVITED" }).success).toBe(false);
  });

  it("accepts a role filter and rejects an unknown role", () => {
    expect(userListQuerySchema.parse({ role: "moderator" }).role).toBe("moderator");
    expect(userListQuerySchema.safeParse({ role: "reviewer" }).success).toBe(false);
  });

  it("clamps an out-of-range limit instead of failing the page", () => {
    expect(userListQuerySchema.parse({ limit: "500" }).limit).toBe(10);
    expect(userListQuerySchema.parse({ limit: "25" }).limit).toBe(25);
    expect(userListQuerySchema.parse({ limit: "0" }).limit).toBe(10);
  });
});
