import type { Request, Response, NextFunction } from "express";
import type * as z from "zod";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/AppError.js";
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

export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const fields = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      next(
        new AppError(
          "Zod schema validation failed on request params",
          StatusCodes.UNPROCESSABLE_ENTITY,
          ErrorCodes.VALIDATION_FAILED,
          { isOperational: true, details: { source: "zod", fields } },
        ),
      );
      return;
    }

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
    // to avoid type conflicts with Express's ParsedQs type. The property is not
    // declared on Express's `Request`, so narrow-shape cast it (same pattern the
    // admin controller uses when reading it) rather than casting the whole
    // request to `any`.
    (req as Request & { validatedQuery?: z.output<T> }).validatedQuery = result.data;
    next();
  };
}