/**
 * unit.interviewState.middleware.test.ts
 * Unit tests for the interview state middleware as mentioned in Priority 2 of the test suite plan.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { requireInterviewState } from "../src/modules/interview/middlewares/interviewState.middleware.js";
import { redisClient } from "../src/config/redis.init.js";
import { AppError } from "../src/utils/appError.js";
import { StatusCodes } from "http-status-codes";

// Mock the AppError as a constructor
vi.mock("../src/utils/appError.js", async (importOriginal) => {
  const actual = await importOriginal();
  class MockAppError extends Error {
    statusCode: number;
    errorCode: string;
    isOperational: boolean;

    constructor(message: string, statusCode: number, errorCode: string, options: { isOperational: boolean }) {
      super(message);
      this.name = 'AppError';
      this.statusCode = statusCode;
      this.errorCode = errorCode;
      this.isOperational = options.isOperational;
    }
  }
  return {
    ...actual,
    AppError: MockAppError,
  };
});

describe("interviewStateMiddleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {};
    mockNext = vi.fn();
    
    vi.clearAllMocks();
  });

  it("should allow requests with valid interview state", () => {
    // Mock that the request has a resource with the correct status
    mockRequest = {
      resource: {
        interviewStatus: "ACTIVE"
      }
    } as any;

    const middleware = requireInterviewState("ACTIVE", "PENDING");
    
    middleware(mockRequest as Request, mockResponse as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it("should reject requests with invalid interview state", () => {
    // Mock that the request has a resource with an invalid status
    mockRequest = {
      resource: {
        interviewStatus: "COMPLETED"
      }
    } as any;

    const middleware = requireInterviewState("ACTIVE", "PENDING");
    
    middleware(mockRequest as Request, mockResponse as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
  });

  it("should reject requests when interview does not exist", () => {
    // Mock that the request has no resource
    mockRequest = {
      resource: undefined
    } as any;

    const middleware = requireInterviewState("ACTIVE", "PENDING");
    
    middleware(mockRequest as Request, mockResponse as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
  });

  it("should handle unauthorized access attempts", () => {
    // Mock that the request has a resource with an unauthorized status
    mockRequest = {
      resource: {
        interviewStatus: "CANCELLED"
      }
    } as any;

    const middleware = requireInterviewState("ACTIVE", "PENDING");
    
    middleware(mockRequest as Request, mockResponse as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
  });

  it("should validate allowed state transitions", () => {
    // Mock that the request has a resource with a valid status for transition
    mockRequest = {
      resource: {
        interviewStatus: "PENDING"
      }
    } as any;

    const middleware = requireInterviewState("PENDING", "ACTIVE");
    
    middleware(mockRequest as Request, mockResponse as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it("should reject invalid state transitions", () => {
    // Mock that the request has a resource with an invalid status for the attempted transition
    mockRequest = {
      resource: {
        interviewStatus: "COMPLETED"
      }
    } as any;

    const middleware = requireInterviewState("ACTIVE", "PENDING");
    
    middleware(mockRequest as Request, mockResponse as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
  });

  it("should handle different valid states", () => {
    // Test with different valid states
    mockRequest = {
      resource: {
        interviewStatus: "DRAFT"
      }
    } as any;

    const middleware = requireInterviewState("DRAFT", "PENDING", "ACTIVE");
    
    middleware(mockRequest as Request, mockResponse as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith();
  });
});