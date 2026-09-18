/**
 * Unit tests for the requireRole middleware
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireRole } from "../src/middlewares/requireRole.middleware.js";
import { AppError } from "../src/utils/appError.js";
import { ErrorCodes } from "../src/constants/errorCodes.js";
import { StatusCodes } from "http-status-codes";

describe("requireRole Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {};
    mockNext = vi.fn();
    
    vi.clearAllMocks();
  });

  it("should call next() when user has required role", () => {
    mockRequest.auth = { userId: "user-id", userRole: "admin" };
    
    const middleware = requireRole("admin", "owner");
    middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });

  it("should call next() with AppError when user does not have required role", () => {
    mockRequest.auth = { userId: "user-id", userRole: "user" };
    
    const middleware = requireRole("admin", "owner");
    middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(
      expect.any(AppError)
    );
    
    const calledArg = mockNext.mock.calls[0][0];
    expect(calledArg).toBeInstanceOf(AppError);
    expect(calledArg.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(calledArg.errorCode).toBe(ErrorCodes.AUTH_FORBIDDEN);
  });

  it("should call next() with AppError when user is not authenticated", () => {
    mockRequest.auth = undefined;
    
    const middleware = requireRole("admin", "owner");
    middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(
      expect.any(AppError)
    );
    
    const calledArg = mockNext.mock.calls[0][0];
    expect(calledArg).toBeInstanceOf(AppError);
    expect(calledArg.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    expect(calledArg.errorCode).toBe(ErrorCodes.AUTH_UNAUTHORIZED);
  });

  it("should allow access for multiple role options", () => {
    mockRequest.auth = { userId: "user-id", userRole: "moderator" };
    
    const middleware = requireRole("admin", "moderator", "owner");
    middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });

  it("should deny access when user role is not in allowed list", () => {
    mockRequest.auth = { userId: "user-id", userRole: "user" };
    
    const middleware = requireRole("admin", "moderator", "owner");
    middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(
      expect.any(AppError)
    );
    
    const calledArg = mockNext.mock.calls[0][0];
    expect(calledArg).toBeInstanceOf(AppError);
    expect(calledArg.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(calledArg.errorCode).toBe(ErrorCodes.AUTH_FORBIDDEN);
  });
});