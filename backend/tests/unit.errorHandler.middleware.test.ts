/**
 * unit.errorHandler.middleware.test.ts
 * Unit tests for the error handler middleware.
 * Tests that the middleware properly handles different error types,
 * including AppError subtypes and unexpected exceptions.
 */

import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../src/middlewares/errorHandler.middleware.js";
import { AppError } from "../src/utils/appError.js";
import { ErrorCodes } from "../src/constants/errorCodes.js";
import { StatusCodes } from "http-status-codes";

// Mock response object
const createMockResponse = () => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnThis();
  res.json = vi.fn().mockReturnThis();
  res.locals = {};
  return res as Response;
};

describe("Error Handler Middleware", () => {
  it("should handle AppError instances correctly", () => {
    const mockReq = {} as Request;
    const mockRes = createMockResponse();
    const mockNext = vi.fn() as NextFunction;

    const appError = new AppError(
      "Test error message",
      StatusCodes.UNAUTHORIZED,
      ErrorCodes.AUTHENTICATION_FAILED,
      true
    );

    errorHandler(appError, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      statusCode: StatusCodes.UNAUTHORIZED,
      message: "Test error message",
      data: null,
      error: {
        code: ErrorCodes.AUTHENTICATION_FAILED,
      },
    });
  });

  it("should handle different AppError subtypes", () => {
    const mockReq = {} as Request;
    const mockRes = createMockResponse();
    const mockNext = vi.fn() as NextFunction;

    // Test with validation error
    const validationError = new AppError(
      "Validation failed",
      StatusCodes.UNPROCESSABLE_ENTITY,
      ErrorCodes.VALIDATION_FAILED,
      true
    );

    errorHandler(validationError, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      message: "Validation failed",
      data: null,
      error: {
        code: ErrorCodes.VALIDATION_FAILED,
      },
    });
  });

  it("should handle non-AppError exceptions as internal server errors", () => {
    const mockReq = {} as Request;
    const mockRes = createMockResponse();
    const mockNext = vi.fn() as NextFunction;

    const genericError = new Error("Generic error");

    errorHandler(genericError, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: "An unexpected error occurred",
      data: null,
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
      },
    });
  });

  it("should handle unknown error types", () => {
    const mockReq = {} as Request;
    const mockRes = createMockResponse();
    const mockNext = vi.fn() as NextFunction;

    // Test with a non-error object
    const unknownError = "Not an error object";

    errorHandler(unknownError as any, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: "An unexpected error occurred",
      data: null,
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
      },
    });
  });

  it("should handle errors with stack traces in development", () => {
    const mockReq = {} as Request;
    const mockRes = createMockResponse();
    const mockNext = vi.fn() as NextFunction;

    // Temporarily set NODE_ENV to development
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const appError = new AppError(
      "Development error",
      StatusCodes.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED,
      true
    );
    appError.stack = "Error stack trace";

    errorHandler(appError, mockReq, mockRes, mockNext);

    // Restore original environment
    process.env.NODE_ENV = originalEnv;

    // In development mode, we'd expect the error to be logged with stack trace
    // Here we just ensure it still responds correctly
    expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
  });

  it("should handle errors with undefined properties safely", () => {
    const mockReq = {} as Request;
    const mockRes = createMockResponse();
    const mockNext = vi.fn() as NextFunction;

    // Create an error-like object with missing properties
    const incompleteError = {
      message: "Incomplete error object",
    };

    errorHandler(incompleteError as any, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: "An unexpected error occurred",
      data: null,
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
      },
    });
  });
});