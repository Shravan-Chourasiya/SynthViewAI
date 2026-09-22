import express from "express";
import { createRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { csrfTokenMiddleware } from "../middlewares/csrf.middleware.js";
import { validateParams, validateQuery } from "../middlewares/zodValidator.middleware.js";
import {
  listNotificationsController,
  markNotificationReadController,
  markAllNotificationsReadController,
} from "../modules/notification/controllers/notification.controller.js";
import {
  notificationIdParamSchema,
  notificationListQuerySchema,
} from "../modules/notification/zodschemas/notification.zschema.js";

const NotificationLimiter = createRateLimiter("INTERVIEW");

export function createNotificationRouter() {
  const router = express.Router();

  // Declared before /:id/read so "read-all" cannot be captured as an :id.
  router.get(
    "/notifications",
    requireAuth,
    csrfTokenMiddleware,
    NotificationLimiter,
    validateQuery(notificationListQuerySchema),
    listNotificationsController,
  );

  router.patch(
    "/notifications/read-all",
    requireAuth,
    csrfTokenMiddleware,
    NotificationLimiter,
    markAllNotificationsReadController,
  );

  router.patch(
    "/notifications/:id/read",
    requireAuth,
    csrfTokenMiddleware,
    NotificationLimiter,
    validateParams(notificationIdParamSchema),
    markNotificationReadController,
  );

  return router;
}
