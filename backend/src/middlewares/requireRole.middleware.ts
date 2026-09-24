import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import { StatusCodes } from "http-status-codes";
import {
  ROLE_LADDER,
  getRoleRank,
  type UserRole,
} from "../constants/roles.constants.js";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        userRole: string;
      };
    }
  }
}

/**
 * Role-based access control middleware factory.
 *
 * Roles form a strict hierarchy — `owner > admin > moderator > user` — and a
 * role inherits every privilege beneath it. The middleware therefore admits the
 * *lowest* role it is given plus every role ranked above it:
 *
 *   requireRole("moderator")            -> moderator, admin, owner
 *   requireRole("admin")                -> admin, owner
 *   requireRole("owner")                -> owner only
 *   requireRole("admin", "moderator")   -> moderator, admin, owner
 *
 * An unknown or missing role never satisfies a check, and calling the factory
 * with no roles denies everyone.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  // The lowest allowed role sets the floor; everything ranked above it inherits access.
  const requiredRank = allowedRoles.reduce(
    (floor, role) => Math.min(floor, getRoleRank(role)),
    Number.POSITIVE_INFINITY
  );

  return (req: Request, res: Response, next: NextFunction): void => {
    // Ensure authentication has already run
    if (!req.auth || !req.auth.userId) {
      return next(
        new AppError(
          "Authentication required before role check",
          StatusCodes.UNAUTHORIZED,
          ErrorCodes.AUTH_UNAUTHORIZED,
          { isOperational: true }
        )
      );
    }

    const userRole = req.auth.userRole as UserRole;
    const userRank = getRoleRank(userRole);

    if (!Number.isFinite(requiredRank) || userRank < requiredRank) {
      return next(
        new AppError(
          `Access denied. Required role: ${allowedRoles.join(" or ") || "none"} ` +
            `(role hierarchy: ${ROLE_LADDER}). Your role: ${userRole ?? "unknown"}`,
          StatusCodes.FORBIDDEN,
          ErrorCodes.AUTH_FORBIDDEN,
          { isOperational: true }
        )
      );
    }

    next();
  };
}
