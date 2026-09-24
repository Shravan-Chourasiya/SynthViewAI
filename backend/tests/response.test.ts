/**
 * response.test.ts
 * Unit tests for AppError and ErrorCodes — no DB/Redis required.
 * NOTE: response.ts uses { success, statusCode, message, data } shape (not { status }).
 */
import { describe, it, expect } from "vitest";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../src/utils/AppError.js";
import { ErrorCodes } from "../src/constants/errorCodes.js";

describe("AppError", () => {
  it("carries the HTTP status code", () => {
    const err = new AppError("Not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND);
    expect(err.statusCode).toBe(404);
  });

  it("carries the stable error code", () => {
    const err = new AppError("Not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND);
    expect(err.errorCode).toBe("RESOURCE_NOT_FOUND");
  });

  it("carries the message", () => {
    const err = new AppError(
      "The password you entered is incorrect",
      StatusCodes.UNAUTHORIZED,
      ErrorCodes.AUTH_INVALID_CREDENTIALS,
    );
    expect(err.message).toBe("The password you entered is incorrect");
  });

  it("is instanceof Error and AppError", () => {
    const err = new AppError("test", StatusCodes.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it("has name set to 'AppError'", () => {
    const err = new AppError("test", StatusCodes.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
    expect(err.name).toBe("AppError");
  });

  it("preserves stack trace", () => {
    const err = new AppError("test", StatusCodes.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("AppError");
  });

  it("isOperational defaults to true for 4xx", () => {
    const err = new AppError("Not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND);
    expect(err.isOperational).toBe(true);
  });

  it("isOperational defaults to false for 5xx", () => {
    const err = new AppError(
      "Internal",
      StatusCodes.INTERNAL_SERVER_ERROR,
      ErrorCodes.INTERNAL_SERVER_ERROR,
    );
    expect(err.isOperational).toBe(false);
  });

  it("isClientSafe is true for 4xx", () => {
    const err = new AppError("Bad request", StatusCodes.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
    expect(err.isClientSafe).toBe(true);
  });

  it("isClientSafe is false for 5xx", () => {
    const err = new AppError(
      "Internal",
      StatusCodes.INTERNAL_SERVER_ERROR,
      ErrorCodes.INTERNAL_SERVER_ERROR,
    );
    expect(err.isClientSafe).toBe(false);
  });

  it("stores structured details", () => {
    const err = new AppError(
      "Validation failed",
      StatusCodes.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED,
      {
        details: { fields: { email: "Invalid email" } },
      },
    );
    expect(err.details).toEqual({ fields: { email: "Invalid email" } });
  });

  it("details is undefined when not provided", () => {
    const err = new AppError("test", StatusCodes.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
    expect(err.details).toBeUndefined();
  });
});

describe("ErrorCodes", () => {
  it("all values are strings", () => {
    for (const code of Object.values(ErrorCodes)) {
      expect(typeof code).toBe("string");
    }
  });

  it("all values are UPPER_SNAKE_CASE", () => {
    for (const code of Object.values(ErrorCodes)) {
      expect(code).toMatch(/^[A-Z][A-Z0-9_]+$/);
    }
  });

  it("includes all expected categories", () => {
    expect(ErrorCodes.INTERNAL_SERVER_ERROR).toBeDefined();
    expect(ErrorCodes.AUTH_INVALID_CREDENTIALS).toBeDefined();
    expect(ErrorCodes.AUTH_UNAUTHORIZED).toBeDefined();
    expect(ErrorCodes.AUTH_FORBIDDEN).toBeDefined();
    expect(ErrorCodes.AUTH_SESSION_EXPIRED).toBeDefined();
    expect(ErrorCodes.VALIDATION_FAILED).toBeDefined();
    expect(ErrorCodes.RESOURCE_NOT_FOUND).toBeDefined();
    expect(ErrorCodes.RESOURCE_ALREADY_EXISTS).toBeDefined();
    expect(ErrorCodes.ROUTE_NOT_FOUND).toBeDefined();
    expect(ErrorCodes.INTERVIEW_NOT_FOUND).toBeDefined();
    expect(ErrorCodes.INTERVIEW_INVALID_STATE).toBeDefined();
    expect(ErrorCodes.RATE_LIMIT_EXCEEDED).toBeDefined();
  });
});
