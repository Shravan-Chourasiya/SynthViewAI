import type { Response, NextFunction, Request } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/AppError.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import type { AuthenticatedRequest } from "../types/request.js";

/**
 * Factory that returns a middleware which:
 * 1. Fetches a resource by `req.params.id`
 * 2. Confirms the authenticated user owns it via `getOwnerId`
 * 3. Attaches the resource to `req.resource` for downstream handlers
 */
export function requireOwnership<T>(
  fetchById: (id: string) => Promise<T | undefined>,
  getOwnerId: (resource: T) => string,
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const id = req.params.id as string | undefined;

      if (!id) {
        throw new AppError(
          "Resource ID is required",
          StatusCodes.BAD_REQUEST,
          ErrorCodes.VALIDATION_FAILED,
          { isOperational: true },
        );
      }

      const resource = await fetchById(id);

      if (!resource) {
        throw new AppError(
          "Resource not found",
          StatusCodes.NOT_FOUND,
          ErrorCodes.RESOURCE_NOT_FOUND,
          { isOperational: true },
        );
      }

      if (getOwnerId(resource) !== authReq.auth.userId) {
        throw new AppError(
          "You do not have permission to access this resource",
          StatusCodes.FORBIDDEN,
          ErrorCodes.AUTH_FORBIDDEN,
          { isOperational: true },
        );
      }

      authReq.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
}
