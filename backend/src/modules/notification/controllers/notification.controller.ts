import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notification.service.js";
import type { SuccessResponse } from "../../../types/response.js";
import type { AuthenticatedRequest } from "../../../types/request.js";
import type { notificationListQuerySchema, notificationIdParamSchema } from "../zodschemas/notification.zschema.js";
import type { z } from "zod";

type ListQuery = z.output<typeof notificationListQuerySchema>;
type IdParam = z.output<typeof notificationIdParamSchema>;

/**
 * GET /notifications
 */
export const listNotificationsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const query = (req as Request & { validatedQuery?: ListQuery }).validatedQuery ?? {
      page: 1,
      limit: 20,
      unreadOnly: false,
    };

    const data = await listNotifications(authreq.auth.userId, query);

    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Notifications retrieved successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /notifications/:id/read
 */
export const markNotificationReadController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const { id } = req.params as unknown as IdParam;

    const data = await markNotificationRead(authreq.auth.userId, id);

    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Notification marked as read.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /notifications/read-all
 */
export const markAllNotificationsReadController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;

    const data = await markAllNotificationsRead(authreq.auth.userId);

    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "All notifications marked as read.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};
