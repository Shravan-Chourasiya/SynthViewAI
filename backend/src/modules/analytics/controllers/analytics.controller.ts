import type { Request, Response, NextFunction } from "express";
import { getUserAnalytics } from "../services/analytics.service.js";
import type { SuccessResponse } from "../../../types/response.js";
import type { AuthenticatedRequest } from "../../../types/request.js";

/**
 * GET /analytics/me
 * Get current user's analytics
 */
export const getUserAnalyticsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).auth!.userId;

    const analytics = await getUserAnalytics(userId);

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "User analytics retrieved successfully",
      data: analytics
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /analytics/me/trend
 * Get user's analytics trend data
 */
export const getUserTrendAnalyticsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).auth!.userId;

    const analytics = await getUserAnalytics(userId);

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "User trend analytics retrieved successfully",
      data: {
        trendData: analytics.trendData,
        overallStats: analytics.overallStats
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};