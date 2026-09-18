import { type ErrorCode } from "../constants/errorCodes.js";

interface AppErrorOptions {
  /** Additional structured context (e.g. validation field errors). */
  details?: unknown;
  /**
   * When `true` the error represents a client mistake (bad input, expired
   * token) — expected, operational, not alarming.
   *
   * When `false` (default) the error represents a server-side failure that
   * the ops team should investigate.
   */
  isOperational?: boolean;
}

/**
 * Application error that carries an HTTP status and a stable machine-readable
 * error code. Throw these from controllers/services to signal known error
 * conditions. The centralized error middleware maps them to the standard
 * {@link ErrorResponse} envelope.
 *
 * AppError intentionally contains NO Express-specific logic. The middleware
 * is responsible for converting it into an HTTP response.
 *
 * **Do not use for unexpected errors** — just `throw new Error(...)` and the
 * centralized middleware will produce a sanitized 500.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly details: unknown;
  public readonly isOperational: boolean;
  public readonly isClientSafe: boolean;

  constructor(
    message: string,
    statusCode: number,
    errorCode: ErrorCode,
    options?: AppErrorOptions,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = options?.details;
    this.isOperational = options?.isOperational ?? statusCode < 500;
    this.isClientSafe = statusCode < 500;

    // Maintain proper prototype chain for instanceof checks.
    Object.setPrototypeOf(this, new.target.prototype);
    // Capture the stack trace but exclude the constructor frame.
    Error.captureStackTrace?.(this, this.constructor);
  }
}