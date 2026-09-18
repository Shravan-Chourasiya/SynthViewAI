import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import { StatusCodes } from "http-status-codes";

// Define UserRole type directly here
type UserRole = 'user' | 'admin' | 'moderator' | 'owner';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        userRole: string;
        [key: string]: any;
      };
    }
  }
}

/**
 * Role-based access control middleware factory
 * Checks if the authenticated user has one of the allowed roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
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
    
    if (!allowedRoles.includes(userRole)) {
      return next(
        new AppError(
          `Access denied. Required role: ${allowedRoles.join(', ')}. Your role: ${userRole}`,
          StatusCodes.FORBIDDEN,
          ErrorCodes.AUTH_FORBIDDEN,
          { isOperational: true }
        )
      );
    }

    next();
  };
}