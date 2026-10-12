import { eq } from "drizzle-orm";
import { getPgDb } from "../../db/postgres.init.js";
import { sessionsTable } from "../../modules/auth/schemas/session.schema.js";
import { usersTable } from "../../modules/auth/schemas/user.schema.js";
import { AppError } from "../../utils/AppError.js";
import { ErrorCodes } from "../../constants/errorCodes.js";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

interface SessionData {
  id: string;
  userId: string;
  tokenFamily: string;
  expiryDate: Date;
  createdAt: Date;
  updatedAt: Date;
  userRole: string;
}

export class SessionService {
  /**
   * Validate a session by ID and token family.
   * Revoked, inactive, expired, or mismatched-family sessions are treated as
   * invalid to guarantee the auth middleware can fail with AUTH_SESSION_EXPIRED.
   */
  static async validateSession(sessionId: string, tokenFamily: string): Promise<SessionData | null> {
    const db = getPgDb();

    const [sessionResult] = await db
      .select({
        id: sessionsTable.id,
        userId: sessionsTable.userId,
        tokenFamily: sessionsTable.tokenFamily,
        expiryDate: sessionsTable.expiryDate,
        createdAt: sessionsTable.createdAt,
        updatedAt: sessionsTable.updatedAt,
        isActive: sessionsTable.isActive,
        isRevoked: sessionsTable.isRevoked,
        isExpired: sessionsTable.isExpired,
      })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);

    if (!sessionResult) {
      return null;
    }

    const session = sessionResult;

    if (
      session.tokenFamily !== tokenFamily ||
      session.isRevoked ||
      !session.isActive ||
      session.isExpired ||
      new Date() > session.expiryDate
    ) {
      await db
        .update(sessionsTable)
        .set({ isActive: false, isRevoked: true, isExpired: true })
        .where(eq(sessionsTable.id, sessionId));
      return null;
    }

    const userResult = await db
      .select({ userrole: usersTable.userrole })
      .from(usersTable)
      .where(eq(usersTable.id, session.userId))
      .limit(1);

    if (!userResult.length) {
      await db
        .update(sessionsTable)
        .set({ isActive: false, isRevoked: true, isExpired: true })
        .where(eq(sessionsTable.id, sessionId));
      return null;
    }

    const sessionData = z
      .object({
        id: z.string(),
        userId: z.string(),
        tokenFamily: z.string(),
        expiryDate: z.instanceof(Date),
        createdAt: z.instanceof(Date),
        updatedAt: z.instanceof(Date),
      })
      .parse(session);

    const userRole = userResult[0]?.userrole;
    if (!userRole) {
      await db
        .update(sessionsTable)
        .set({ isActive: false, isRevoked: true, isExpired: true })
        .where(eq(sessionsTable.id, sessionId));
      return null;
    }

    return {
      ...sessionData,
      userRole,
    };
  }

  /**
   * Extend a session's expiration time
   */
  static async extendSession(sessionId: string): Promise<void> {
    const db = getPgDb();
    const { REFRESH_TOKEN_TTL_SECONDS } = await import("../../constants/auth.constants.js");

    // Update session to extend expiration
    await db
      .update(sessionsTable)
      .set({ 
        expiryDate: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
        updatedAt: new Date()
      })
      .where(eq(sessionsTable.id, sessionId));
  }

  /**
   * Create a new session
   */
  static async createSession(userId: string, tokenFamily: string): Promise<SessionData> {
    const db = getPgDb();
    const { REFRESH_TOKEN_TTL_SECONDS } = await import("../../constants/auth.constants.js");

    const expiryDate = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    const result = await db
      .insert(sessionsTable)
      .values({
        userId,
        tokenFamily,
        refreshToken: '', // Will be set when token is created
        accessToken: '', // Will be set when token is created
        csrfToken: '', // Will be set when session is created
        deviceId: '', // Will be set when session is created
        ipAddress: '', // Will be set when session is created
        userAgent: '', // Will be set when session is created
        expiryDate,
      })
      .returning();

    if (!result || result.length === 0) {
      throw new AppError(
        "Failed to create session",
        StatusCodes.INTERNAL_SERVER_ERROR,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        { isOperational: false }
      );
    }

    const session = result[0];

    // Get user role
    const userResult = await db
      .select({ userrole: usersTable.userrole })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!userResult.length) {
      throw new AppError(
        "User not found",
        StatusCodes.NOT_FOUND,
        ErrorCodes.RESOURCE_NOT_FOUND,
        { isOperational: true }
      );
    }

    // Validate session data before returning
    const sessionData = z.object({
      id: z.string(),
      userId: z.string(),
      tokenFamily: z.string(),
      expiryDate: z.instanceof(Date),
      createdAt: z.instanceof(Date),
      updatedAt: z.instanceof(Date),
    }).parse(session);

    // Validate user role
    const userRole = userResult[0]?.userrole;
    if (!userRole) {
      throw new AppError(
        "User role not found",
        StatusCodes.NOT_FOUND,
        ErrorCodes.RESOURCE_NOT_FOUND,
        { isOperational: true }
      );
    }

    return {
      ...sessionData,
      userRole,
    };
  }

  /**
   * Revoke a session
   */
  static async revokeSession(sessionId: string): Promise<void> {
    const db = getPgDb();
    await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
  }
}