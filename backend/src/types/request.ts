import type { Request } from "express";
import type { COOKIE_NAMES } from "../constants/auth.constants.js";

export interface StandardRequest extends Request {
  _id?: string;  // For request ID
  userId?: string;  // For user ID in standard requests
  userRole?: string;  // For user role in standard requests
  resource?: any;  // For ownership middleware
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