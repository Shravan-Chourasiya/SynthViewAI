import type { Request, Response, NextFunction } from "express";
import type * as z from "zod";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/appError.js";
import { ErrorCodes } from "../constants/errorCodes.js";

export interface ValidatedRequest<T> extends Request {
  body: T;
}

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fields = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      next(
        new AppError(
          "Zod schema validation failed on request body",
          StatusCodes.UNPROCESSABLE_ENTITY,
          ErrorCodes.VALIDATION_FAILED,
          { isOperational: true, details: { source: "zod", fields } },
        ),
      );
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const fields = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      next(
        new AppError(
          "Zod schema validation failed on request query",
          StatusCodes.UNPROCESSABLE_ENTITY,
          ErrorCodes.VALIDATION_FAILED,
          { isOperational: true, details: { source: "zod", fields } },
        ),
      );
      return;
    }

    // Instead of assigning directly to req.query, assign to a custom property
    // to avoid type conflicts with Express's ParsedQs type
    (req as any).validatedQuery = result.data;
    next();
  };
}