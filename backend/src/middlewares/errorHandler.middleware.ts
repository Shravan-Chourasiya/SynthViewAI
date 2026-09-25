import { type ErrorRequestHandler, type NextFunction, type Request } from "express";
import { StatusCodes } from "http-status-codes";

import { logger } from "../utils/logger.js";
import type { ErrorResponse } from "../types/response.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import type { StandardRequest } from "../types/request.js";
import { AppError } from "../utils/AppError.js";

function getRoutePath(req: Request): string | undefined {
  const route = (req as { route?: { path?: string } }).route;
  return route?.path;
}

export function toErrorLike(value: unknown): {
  name: string;
  message: string;
  stack: string | undefined;
} {
  if (value instanceof Error) {
    // JWT errors — matched on `.name`, which is what jsonwebtoken actually sets.
    // (Matching on `.message.includes(...)` does not work: the message text
    // does not contain the error class name.)
    if (value.name === "JsonWebTokenError") {
      return { name: "JWTError", message: value.message, stack: value.stack };
    }
    if (value.name === "TokenExpiredError") {
      return { name: "JWTExpiredError", message: value.message, stack: value.stack };
    }
    if (value.name === "NotBeforeError") {
      return { name: "JWTNotBeforeError", message: value.message, stack: value.stack };
    }

    // Errors that carry a string `code` — SMTP replies and socket/TLS failures
    // from the mail transport, plus Postgres and Redis errors. The code is the
    // useful part of the log line, so surface it in the name.
    if ("code" in value && typeof value.code === "string") {
      return {
        name: `TransportError:${value.code}`,
        message: value.message,
        stack: value.stack,
      };
    }

    if (value.name?.toLowerCase().includes("langchain")) {
      return { name: "LangChainError", message: value.message, stack: value.stack };
    }

    // Generic Error fallback
    return { name: value.name, message: value.message, stack: value.stack };
  }

  if (typeof value === "string") {
    return { name: "Error", message: value, stack: undefined };
  }

  return { name: "UnknownError", message: String(value), stack: undefined };
}

/**
 * Centralized Express error-handling middleware.
 *
 * This middleware:
 * - Catches AppError and maps it to the standard ErrorResponse envelope,
 *   but ONLY exposes the AppError's message/details to the client when the
 *   error is client-safe (4xx). A 5xx AppError — even if constructed with a
 *   leaky message by mistake elsewhere in the codebase — is logged in full
 *   but the client still receives the generic sanitized response. This is a
 *   structural safeguard, not just a convention: it does not depend on every
 *   call site correctly hand-writing safe messages.
 * - Catches unexpected (non-AppError) errors and produces a sanitized 500
 *   response.
 * - Logs unexpected AND internal (5xx AppError) errors with structured
 *   context, including stack traces, server-side only.
 * - Never exposes internal implementation details, stack traces, or
 *   database/Redis/infrastructure internals to clients.
 *
 * **Must be registered LAST** among Express middleware that handles requests.
 *
 * PREREQUISITE: async route handlers must forward thrown errors to `next()`
 * for this middleware to ever run on them. Ensure `express-async-errors` is
 * imported at app entry, or every async handler is wrapped to catch and
 * forward rejections. Without this, async errors become unhandled
 * rejections and never reach this handler at all.
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next: NextFunction) => {
  const sreq = req as StandardRequest;

  const isAppError = err instanceof AppError;
  const isClientSafe = isAppError && err.isClientSafe;

  // Log anything that isn't a client-safe AppError: unexpected errors AND
  // 5xx AppErrors both warrant full server-side logging.
  if (!isClientSafe) {
    const errorObj = toErrorLike(err);
    logger.error(
      {
        requestId: sreq._id,
        method: sreq.method,
        path: sreq.path,
        route: getRoutePath(sreq),
        ...(sreq.userId && { userId: sreq.userId }),
        ...(sreq.userRole && { role: sreq.userRole }),
        ...(isAppError && { errorCode: err.errorCode, statusCode: err.statusCode }),
        error: {
          name: errorObj.name,
          message: errorObj.message,
          stack: errorObj.stack,
        },
      },
      isAppError ? "Internal AppError (5xx)" : "Unexpected error",
    );
  }

  // Client-safe AppError (4xx): safe to return message/details verbatim.
  if (isClientSafe) {
    const response: ErrorResponse = {
      success: false,
      statusCode: err.statusCode,
      message: err.message,
      data: null,
      error: {
        code: err.errorCode,
        ...(err.details !== undefined && { details: err.details }),
      },
    };
    return res.status(err.statusCode).json(response);
  }

  const response: ErrorResponse = {
    success: false,
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    message: "An unexpected error occurred",
    data: null,
    error: {
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
    },
  };
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(response);
};
