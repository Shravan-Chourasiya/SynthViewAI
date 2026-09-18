import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { 
  getUserAnalyticsController,
  getUserTrendAnalyticsController
} from "../modules/analytics/controllers/analytics.controller.js";

const router = Router();

// Define analytics rate limiter
const analyticsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 50, // Limit each IP to 50 requests per windowMs
  message: {
    success: false,
    statusCode: 429,
    message: "Too many requests from this IP, please try again later.",
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Analytics routes - require authentication
router.get(
  "/me",
  analyticsRateLimiter,
  requireAuth,
  getUserAnalyticsController
);

router.get(
  "/me/trend",
  analyticsRateLimiter,
  requireAuth,
  getUserTrendAnalyticsController
);

export default router;