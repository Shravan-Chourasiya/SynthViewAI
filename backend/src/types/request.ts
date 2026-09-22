import type { Request } from "express";

export interface StandardRequest extends Request {
  _id?: string;  // For request ID
  userId?: string;  // For user ID in standard requests
  userRole?: string;  // For user role in standard requests
  // Attached by the ownership middleware; the concrete row type is generic per
  // route, so consumers narrow it (see interviewState.middleware.ts).
  resource?: unknown;  // For ownership middleware
}

export interface AuthenticatedRequest extends StandardRequest {
  auth: {
    userId: string;
    sessionId: string;
    tokenFamily: string;
    accessToken: string;
    refreshToken: string;
    userRole: string; // Making userRole required for authenticated requests
  };
}