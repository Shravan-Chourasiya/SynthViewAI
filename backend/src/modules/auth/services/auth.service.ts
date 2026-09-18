import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import bcrypt from "bcrypt";
import { AppError } from "../../../utils/appError.js";
import { ErrorCodes } from "../../../constants/errorCodes.js";
import { getRandomOtp } from "../../../utils/email.js";
import { sendOtpMail } from "../../../services/nodemailer.service.js";
import { otpService } from "../../../services/redis.service.js";
import { getPgDb } from "../../../db/postgres.init.js";
import { usersTable } from "../schemas/user.schema.js";
import { sessionsTable } from "../schemas/session.schema.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  blacklistToken,
  isTokenBlacklisted,
} from "../../../utils/token.util.js";
import type {
  RegisterInput,
  VerifyOtpInput,
  LoginInput,
  ForgotPasswordInput,
  ForgotPasswordOtpVerifyInput,
  RecoverAccountOtpInput,
  UpdatePasswordInput,
  UpdateEmailInput,
  UpdateProfileInput,
  EmailUpdateOtpVerifyInput,
} from "../zodschemas/auth.zschema.js";
import type { LoginResult } from "../types/user.types.js";

import {
  SALT_ROUNDS,
  OTP_PURPOSE,
  MAX_SESSIONS,
  SESSION_EXPIRY_MS,
  ACCOUNT_RECOVERY_WINDOW_MS,
} from "../../../constants/auth.constants.js";
import { generateCsrfToken } from "../../../utils/csrf.js";

// ── Register ──────────────────────────────────────────────────────────────────

export async function registerUserService(input: RegisterInput): Promise<void> {
  const db = getPgDb();

  const existing = await db
    .select({ id: usersTable.id, isVerified: usersTable.isVerified })
    .from(usersTable)
    .where(eq(usersTable.email, input.email))
    .limit(1);

  const existingUser = existing[0];
  if (existingUser) {
    if (!existingUser.isVerified) {
      await sendRegistrationOtp(input.email, existingUser.id);
      return;
    }

    throw new AppError(
      "An account with this email already exists",
      StatusCodes.CONFLICT,
      ErrorCodes.RESOURCE_ALREADY_EXISTS,
      { isOperational: true },
    );
  }

  await sendRegistrationOtp(
    input.email,
    undefined,
    JSON.stringify({
      username: input.username,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
    }),
  );
}

async function sendRegistrationOtp(email: string, userId?: string, newValue?: string): Promise<void> {
  const otp = getRandomOtp(6);
  await otpService.storeOTP(email, otp, OTP_PURPOSE.REGISTER, userId, newValue);
  await sendOtpMail(email, otp);
}

export async function verifyOtpService(input: VerifyOtpInput): Promise<void> {
  const result = await otpService.verifyOTP(input.email, input.otp, OTP_PURPOSE.REGISTER);

  if (!result.success) {
    const isRateLimit =
      result.message.toLowerCase().includes("too many") ||
      result.message.toLowerCase().includes("maximum attempts");
    throw new AppError(
      result.message,
      isRateLimit ? StatusCodes.TOO_MANY_REQUESTS : StatusCodes.UNAUTHORIZED,
      isRateLimit ? ErrorCodes.RATE_LIMIT_EXCEEDED : ErrorCodes.AUTH_INVALID_CREDENTIALS,
      { isOperational: true },
    );
  }

  const db = getPgDb();

  if (result.userId) {
    const updated = await db
      .update(usersTable)
      .set({ isVerified: true })
      .where(and(eq(usersTable.id, result.userId), eq(usersTable.isVerified, false)))
      .returning({ id: usersTable.id });

    if (updated.length === 0) {
      throw new AppError(
        "This account is already verified or no longer exists",
        StatusCodes.CONFLICT,
        ErrorCodes.RESOURCE_ALREADY_EXISTS,
        { isOperational: true },
      );
    }
    return;
  }

  if (!result.newValue) {
    throw new AppError(
      "Registration data missing, please register again",
      StatusCodes.UNPROCESSABLE_ENTITY,
      ErrorCodes.VALIDATION_FAILED,
      { isOperational: true },
    );
  }

  const data = JSON.parse(result.newValue) as {
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  };
  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

  await db.insert(usersTable).values({
    email: input.email,
    password: hashedPassword,
    username: data.username,
    firstName: data.firstName,
    lastName: data.lastName,
    isVerified: true,
  });
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function loginService(
  input: LoginInput,
  ipAddress: string,
  userAgent: string,
  existingDeviceId?: string,
): Promise<LoginResult> {
  const db = getPgDb();

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, input.email))
    .limit(1);

  if (!user) {
    throw new AppError(
      "Invalid email or password",
      StatusCodes.UNAUTHORIZED,
      ErrorCodes.AUTH_INVALID_CREDENTIALS,
      { isOperational: true },
    );
  }

  if (user.accountStatus === "disabled") {
    throw new AppError(
      "This account has been disabled. Use account recovery to restore it.",
      StatusCodes.FORBIDDEN,
      ErrorCodes.AUTH_FORBIDDEN,
      { isOperational: true },
    );
  }

  if (user.accountStatus === "suspended" || user.accountStatus === "deleted") {
    throw new AppError(
      "Account is not accessible",
      StatusCodes.FORBIDDEN,
      ErrorCodes.AUTH_FORBIDDEN,
      { isOperational: true },
    );
  }

  const passwordMatch = await bcrypt.compare(input.password, user.password);
  if (!passwordMatch) {
    throw new AppError(
      "Invalid email or password",
      StatusCodes.UNAUTHORIZED,
      ErrorCodes.AUTH_INVALID_CREDENTIALS,
      { isOperational: true },
    );
  }

  if (!user.isVerified) {
    await sendRegistrationOtp(user.email, user.id);
    throw new AppError(
      "Please verify your email before logging in. A new verification code has been sent.",
      StatusCodes.FORBIDDEN,
      ErrorCodes.AUTH_FORBIDDEN,
      { isOperational: true },
    );
  }

  // Enforce max session limit
  const activeSessions = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, user.id), eq(sessionsTable.isActive, true)));

  if (activeSessions.length >= MAX_SESSIONS) {
    throw new AppError(
      "Maximum active sessions reached. Please log out from another device.",
      StatusCodes.CONFLICT,
      ErrorCodes.RESOURCE_CONFLICT,
      { isOperational: true },
    );
  }

  const deviceId = existingDeviceId ?? randomUUID();
  const tokenFamily = randomUUID();
  const expiryDate = new Date(Date.now() + SESSION_EXPIRY_MS);

  const accessToken = signAccessToken({ userId: user.id, sessionId: "", tokenFamily });
  const refreshToken = signRefreshToken({ userId: user.id, sessionId: "", tokenFamily });
  const csrfToken = generateCsrfToken();
  const [session] = await db
    .insert(sessionsTable)
    .values({
      userId: user.id,
      tokenFamily,
      refreshToken,
      accessToken,
      csrfToken,
      isActive: true,
      isRevoked: false,
      isExpired: false,
      expiryDate,
      loginCount: 1,
      failedLoginAttempts: 0,
      deviceType: input.deviceType,
      deviceId,
      ipAddress,
      userAgent,
      activeSessionCount: activeSessions.length + 1,
      totalSessionCount: activeSessions.length + 1,
    })
    .returning({ id: sessionsTable.id });

  if (!session) {
    throw new AppError(
      "Failed to create session",
      StatusCodes.INTERNAL_SERVER_ERROR,
      ErrorCodes.INTERNAL_SERVER_ERROR,
    );
  }

  // Re-sign with actual sessionId
  const finalAccessToken = signAccessToken({ userId: user.id, sessionId: session.id, tokenFamily });
  const finalRefreshToken = signRefreshToken({
    userId: user.id,
    sessionId: session.id,
    tokenFamily,
  });

  await db
    .update(sessionsTable)
    .set({
      accessToken: finalAccessToken,
      refreshToken: finalRefreshToken,
      csrfToken,
    })
    .where(eq(sessionsTable.id, session.id));

  await db
    .update(usersTable)
    .set({ sessionCount: activeSessions.length + 1 })
    .where(eq(usersTable.id, user.id));

  return {
    accessToken: finalAccessToken,
    refreshToken: finalRefreshToken,
    csrfToken,
    deviceId,
    sessionId: session.id,
  };
}

// ── Token Refresh ─────────────────────────────────────────────────────────────

export async function refreshTokenService(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; csrfToken: string }> {
  const blacklisted = await isTokenBlacklisted(refreshToken);
  if (blacklisted) {
    throw new AppError(
      "Session has been revoked",
      StatusCodes.UNAUTHORIZED,
      ErrorCodes.AUTH_SESSION_EXPIRED,
      { isOperational: true },
    );
  }

  let payload;
  try {
    payload = verifyToken(refreshToken);
  } catch {
    throw new AppError(
      "Invalid or expired session",
      StatusCodes.UNAUTHORIZED,
      ErrorCodes.AUTH_SESSION_EXPIRED,
      { isOperational: true },
    );
  }

  if (payload.type !== "refresh") {
    throw new AppError(
      "Invalid token type",
      StatusCodes.UNAUTHORIZED,
      ErrorCodes.AUTH_UNAUTHORIZED,
      { isOperational: true },
    );
  }

  const db = getPgDb();
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.id, payload.sessionId),
        eq(sessionsTable.tokenFamily, payload.tokenFamily),
        eq(sessionsTable.isActive, true),
        eq(sessionsTable.isRevoked, false),
      ),
    )
    .limit(1);

  if (!session) {
    // Token family reuse detected — invalidate entire family
    await db
      .update(sessionsTable)
      .set({ isRevoked: true, isActive: false })
      .where(eq(sessionsTable.tokenFamily, payload.tokenFamily));
    throw new AppError(
      "Session reuse detected. All sessions invalidated.",
      StatusCodes.UNAUTHORIZED,
      ErrorCodes.AUTH_SESSION_EXPIRED,
      { isOperational: true },
    );
  }

  // Blacklist old tokens
  await blacklistToken(refreshToken);
  await blacklistToken(session.accessToken);

  const newAccessToken = signAccessToken({
    userId: payload.userId,
    sessionId: session.id,
    tokenFamily: payload.tokenFamily,
  });
  const newRefreshToken = signRefreshToken({
    userId: payload.userId,
    sessionId: session.id,
    tokenFamily: payload.tokenFamily,
  });
  const newCsrfToken = generateCsrfToken();

  await db
    .update(sessionsTable)
    .set({ accessToken: newAccessToken, refreshToken: newRefreshToken, csrfToken: newCsrfToken })
    .where(eq(sessionsTable.id, session.id));

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, csrfToken: newCsrfToken };
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logoutService(
  sessionId: string,
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const db = getPgDb();

  const [session] = await db
    .select({ id: sessionsTable.id, userId: sessionsTable.userId })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, sessionId), eq(sessionsTable.isActive, true)))
    .limit(1);

  if (!session) {
    throw new AppError("Session not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, {
      isOperational: true,
    });
  }

  await Promise.all([
    blacklistToken(accessToken),
    blacklistToken(refreshToken),
    db
      .update(sessionsTable)
      .set({ isActive: false, isRevoked: true })
      .where(eq(sessionsTable.id, sessionId)),
  ]);

  // Decrement user session count
  const [user] = await db
    .select({ sessionCount: usersTable.sessionCount })
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .limit(1);
  if (user) {
    await db
      .update(usersTable)
      .set({ sessionCount: Math.max(0, user.sessionCount - 1) })
      .where(eq(usersTable.id, session.userId));
  }
}

// ── Delete Account (soft delete) ──────────────────────────────────────────────

export async function deleteAccountService(
  userId: string,
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const db = getPgDb();

  const [user] = await db
    .select({ id: usersTable.id, accountStatus: usersTable.accountStatus })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    throw new AppError("User not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, {
      isOperational: true,
    });
  }

  const now = new Date();
  const scheduledDeletionAt = new Date(now.getTime() + ACCOUNT_RECOVERY_WINDOW_MS);

  await Promise.all([
    db
      .update(usersTable)
      .set({ accountStatus: "disabled", disabledAt: now, scheduledDeletionAt })
      .where(eq(usersTable.id, userId)),
    db
      .update(sessionsTable)
      .set({ isActive: false, isRevoked: true })
      .where(eq(sessionsTable.userId, userId)),
    blacklistToken(accessToken),
    blacklistToken(refreshToken),
  ]);
}

// ── Recover Account — Send OTP ────────────────────────────────────────────────

export async function recoverAccountService(email: string): Promise<void> {
  const db = getPgDb();

  const [user] = await db
    .select({ id: usersTable.id, accountStatus: usersTable.accountStatus })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user || user.accountStatus !== "disabled") {
    // Intentionally vague — don't reveal whether email exists
    return;
  }

  const otp = getRandomOtp(6);
  await otpService.storeOTP(email, otp, OTP_PURPOSE.RECOVER_ACCOUNT, user.id);
  await sendOtpMail(email, otp);
}

// ── Recover Account — Verify OTP ──────────────────────────────────────────────

export async function recoverAccountOtpService(input: RecoverAccountOtpInput): Promise<void> {
  const result = await otpService.verifyOTP(input.email, input.otp, OTP_PURPOSE.RECOVER_ACCOUNT);

  if (!result.success) {
    const isRateLimit =
      result.message.toLowerCase().includes("too many") ||
      result.message.toLowerCase().includes("maximum attempts");
    throw new AppError(
      result.message,
      isRateLimit ? StatusCodes.TOO_MANY_REQUESTS : StatusCodes.UNAUTHORIZED,
      isRateLimit ? ErrorCodes.RATE_LIMIT_EXCEEDED : ErrorCodes.AUTH_INVALID_CREDENTIALS,
      { isOperational: true },
    );
  }

  const db = getPgDb();
  await db
    .update(usersTable)
    .set({ accountStatus: "active", disabledAt: null, scheduledDeletionAt: null })
    .where(eq(usersTable.email, input.email));
}

// ── Forgot Password — Send OTP ────────────────────────────────────────────────

export async function forgotPasswordService(input: ForgotPasswordInput): Promise<void> {
  const db = getPgDb();

  const [user] = await db
    .select({ id: usersTable.id, accountStatus: usersTable.accountStatus })
    .from(usersTable)
    .where(eq(usersTable.email, input.email))
    .limit(1);

  // Intentionally vague — don't reveal whether email exists
  if (!user || user.accountStatus !== "active") return;

  const otp = getRandomOtp(6);
  await otpService.storeOTP(input.email, otp, OTP_PURPOSE.FORGOT_PASSWORD, user.id);
  await sendOtpMail(input.email, otp);
}

// ── Forgot Password — Verify OTP + Reset ─────────────────────────────────────

export async function forgotPasswordOtpVerifyService(
  input: ForgotPasswordOtpVerifyInput,
): Promise<void> {
  const result = await otpService.verifyOTP(input.email, input.otp, OTP_PURPOSE.FORGOT_PASSWORD);

  if (!result.success) {
    const isRateLimit =
      result.message.toLowerCase().includes("too many") ||
      result.message.toLowerCase().includes("maximum attempts");
    throw new AppError(
      result.message,
      isRateLimit ? StatusCodes.TOO_MANY_REQUESTS : StatusCodes.UNAUTHORIZED,
      isRateLimit ? ErrorCodes.RATE_LIMIT_EXCEEDED : ErrorCodes.AUTH_INVALID_CREDENTIALS,
      { isOperational: true },
    );
  }

  const db = getPgDb();
  const hashedPassword = await bcrypt.hash(input.newPassword, SALT_ROUNDS);

  // Invalidate all active sessions on password reset
  const sessions = await db
    .select({ accessToken: sessionsTable.accessToken, refreshToken: sessionsTable.refreshToken })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, result.userId!), eq(sessionsTable.isActive, true)));

  await Promise.all([
    db
      .update(usersTable)
      .set({ password: hashedPassword })
      .where(eq(usersTable.email, input.email)),
    db
      .update(sessionsTable)
      .set({ isActive: false, isRevoked: true })
      .where(eq(sessionsTable.userId, result.userId!)),
    ...sessions.flatMap((s) => [blacklistToken(s.accessToken), blacklistToken(s.refreshToken)]),
  ]);
}

// ── Update Password — Send OTP ────────────────────────────────────────────────

export async function updatePasswordService(input: UpdatePasswordInput): Promise<void> {
  const db = getPgDb();

  const [user] = await db
    .select({
      id: usersTable.id,
      accountStatus: usersTable.accountStatus,
      password: usersTable.password,
    })
    .from(usersTable)
    .where(eq(usersTable.email, input.email))
    .limit(1);

  const isPasswordMatch = user ? await bcrypt.compare(input.currentPassword, user.password) : false;

  if (!user || user.accountStatus !== "active" || !isPasswordMatch) {
    throw new AppError(
      "Invalid email or current password",
      StatusCodes.UNAUTHORIZED,
      ErrorCodes.AUTH_INVALID_CREDENTIALS,
      { isOperational: true },
    );
  }

  const isNewPasswordSameAsCurrent = input.currentPassword === input.newPassword;
  if (isNewPasswordSameAsCurrent) {
    throw new AppError(
      "New password cannot be the same as the current password",
      StatusCodes.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED,
      { isOperational: true },
    );
  }

  await db
    .update(usersTable)
    .set({ password: await bcrypt.hash(input.newPassword, SALT_ROUNDS) })
    .where(eq(usersTable.email, input.email));

  // Invalidate all active sessions on password change
  const sessions = await db
    .select({ accessToken: sessionsTable.accessToken, refreshToken: sessionsTable.refreshToken })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, user.id), eq(sessionsTable.isActive, true)));

  await Promise.all([
    db
      .update(sessionsTable)
      .set({ isActive: false, isRevoked: true })
      .where(eq(sessionsTable.userId, user.id)),
    ...sessions.flatMap((s) => [blacklistToken(s.accessToken), blacklistToken(s.refreshToken)]),
  ]);

  return;
}

// ── Update Email — Send OTP ────────────────────────────────────────────────

export async function updateEmailService(input: UpdateEmailInput): Promise<void> {
  const db = getPgDb();

  const [user] = await db
    .select({ id: usersTable.id, accountStatus: usersTable.accountStatus })
    .from(usersTable)
    .where(eq(usersTable.email, input.email))
    .limit(1);

  // Intentionally vague — don't reveal whether email exists
  if (!user || user.accountStatus !== "active") return;

  const otp = getRandomOtp(6);
  await otpService.storeOTP(input.email, otp, OTP_PURPOSE.UPDATE_EMAIL, user.id);
  await sendOtpMail(input.email, otp);
}

// ── Email Update — Verify OTP + Reset ─────────────────────────────────────

export async function emailUpdateOtpVerifyService(input: EmailUpdateOtpVerifyInput): Promise<void> {
  const result = await otpService.verifyOTP(input.email, input.otp, OTP_PURPOSE.UPDATE_EMAIL);

  if (!result.success) {
    const isRateLimit =
      result.message.toLowerCase().includes("too many") ||
      result.message.toLowerCase().includes("maximum attempts");
    throw new AppError(
      result.message,
      isRateLimit ? StatusCodes.TOO_MANY_REQUESTS : StatusCodes.UNAUTHORIZED,
      isRateLimit ? ErrorCodes.RATE_LIMIT_EXCEEDED : ErrorCodes.AUTH_INVALID_CREDENTIALS,
      { isOperational: true },
    );
  }

  const db = getPgDb();
  // Invalidate all active sessions on password reset
  const sessions = await db
    .select({ accessToken: sessionsTable.accessToken, refreshToken: sessionsTable.refreshToken })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, result.userId!), eq(sessionsTable.isActive, true)));

  await Promise.all([
    db.update(usersTable).set({ email: result.newValue! }).where(eq(usersTable.email, input.email)),
    db
      .update(sessionsTable)
      .set({ isActive: false, isRevoked: true })
      .where(eq(sessionsTable.userId, result.userId!)),
    ...sessions.flatMap((s) => [blacklistToken(s.accessToken), blacklistToken(s.refreshToken)]),
  ]);
}

// ── Get Current User Info ─────────────────────────────────────────────────────
export async function getMeService(userId: string) {
  const db = getPgDb();

  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      username: usersTable.username,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      bio: usersTable.bio,
      userrole: usersTable.userrole,
      accountStatus: usersTable.accountStatus,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    throw new AppError("User not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, {
      isOperational: true,
    });
  }

  return user;
}

export async function updateProfileService(
  userId: string,
  input: UpdateProfileInput,
) {
  const db = getPgDb();
  const [user] = await db
    .update(usersTable)
    .set({
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName || null } : {}),
    })
    .where(eq(usersTable.id, userId))
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      username: usersTable.username,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      bio: usersTable.bio,
      userrole: usersTable.userrole,
      accountStatus: usersTable.accountStatus,
      createdAt: usersTable.createdAt,
    });

  if (!user) {
    throw new AppError("User not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, {
      isOperational: true,
    });
  }

  return user;
}

// ── Get All User Sessions ─────────────────────────────────────────────────────
export async function getSessionsService(userId: string) {
  const db = getPgDb();

  const sessions = await db
    .select({
      id: sessionsTable.id,
      deviceId: sessionsTable.deviceId,
      deviceType: sessionsTable.deviceType,
      totalSessionCount: sessionsTable.totalSessionCount,
      activeSessionCount: sessionsTable.activeSessionCount,
      ipAddress: sessionsTable.ipAddress,
      userAgent: sessionsTable.userAgent,
      loginCount: sessionsTable.loginCount,
      failedLoginAttempts: sessionsTable.failedLoginAttempts,
      isActive: sessionsTable.isActive,
      isRevoked: sessionsTable.isRevoked,
      isExpired: sessionsTable.isExpired,
      expiryDate: sessionsTable.expiryDate,
      createdAt: sessionsTable.createdAt,
    })
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, userId));

  return sessions;
}

// ── Delete All Sessions ─────────────────────────────────────────────────────
export async function deleteAllSessionsService(userId: string) {
  const db = getPgDb();

  const sessions = await db
    .select({
      accessToken: sessionsTable.accessToken,
      refreshToken: sessionsTable.refreshToken,
      tokenFamily: sessionsTable.tokenFamily,
    })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, userId), eq(sessionsTable.isActive, true)));

  if (!sessions) {
    throw new AppError(
      "No sessions found for the User",
      StatusCodes.NOT_FOUND,
      ErrorCodes.RESOURCE_NOT_FOUND,
      {
        isOperational: true,
      },
    );
  }
  await Promise.all([
    db
      .update(sessionsTable)
      .set({ isActive: false, isRevoked: true })
      .where(eq(sessionsTable.userId, userId)),
    ...sessions.flatMap((s) => [
      blacklistToken(s.accessToken),
      blacklistToken(s.refreshToken),
      blacklistToken(s.tokenFamily),
    ]),
  ]);
}

// ── Delete Specific Session ─────────────────────────────────────────────────────
export async function deleteSessionService(userId: string, sessionId: string) {
  const db = getPgDb();

  const [session] = await db
    .select({
      accessToken: sessionsTable.accessToken,
      refreshToken: sessionsTable.refreshToken,
      tokenFamily: sessionsTable.tokenFamily,
    })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, userId), eq(sessionsTable.id, sessionId)))
    .limit(1);

  if (!session) {
    throw new AppError("Session not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, {
      isOperational: true,
    });
  }

  await Promise.all([
    db
      .update(sessionsTable)
      .set({ isActive: false, isRevoked: true })
      .where(eq(sessionsTable.id, sessionId)),
    blacklistToken(session.accessToken),
    blacklistToken(session.refreshToken),
    blacklistToken(session.tokenFamily),
  ]);
}
