import { type Request, type Response, type NextFunction } from "express";
import { verifyToken } from "../utils/token.util.js";
import { SessionService } from "../services/auth/session.service.js";
import { COOKIE_NAMES } from "../constants/auth.constants.js";
import { AppError } from "../utils/AppError.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import { StatusCodes } from "http-status-codes";
import type { AuthenticatedRequest } from "../types/request.js";

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.[COOKIE_NAMES.ACCESS] as
      | string
      | undefined;

    if (!token) {
      throw new AppError(
        "Access token is required",
        StatusCodes.UNAUTHORIZED,
        ErrorCodes.AUTH_UNAUTHORIZED,
        { isOperational: true }
      );
    }

    const payload = verifyToken(token);

    if (!payload) {
      throw new AppError(
        "Invalid or expired access token",
        StatusCodes.UNAUTHORIZED,
        ErrorCodes.AUTH_UNAUTHORIZED,
        { isOperational: true }
      );
    }

    // Verify session is still valid
    const session = await SessionService.validateSession(payload.sessionId, payload.tokenFamily);

    if (!session) {
      throw new AppError(
        "Session not found or expired",
        StatusCodes.UNAUTHORIZED,
        ErrorCodes.AUTH_UNAUTHORIZED,
        { isOperational: true }
      );
    }

    // Extend session
    await SessionService.extendSession(payload.sessionId);

    // Attach user info to request
    (req as AuthenticatedRequest).auth = {
      userId: session.userId,
      sessionId: session.id,
      tokenFamily: session.tokenFamily,
      accessToken: token,
      refreshToken: req.cookies?.[COOKIE_NAMES.REFRESH] as string,
      userRole: session.userRole, // Adding user role to the auth object
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(
        new AppError(
          "Authentication failed",
          StatusCodes.UNAUTHORIZED,
          ErrorCodes.AUTH_UNAUTHORIZED,
          { isOperational: true }
        )
      );
    }
  }
};