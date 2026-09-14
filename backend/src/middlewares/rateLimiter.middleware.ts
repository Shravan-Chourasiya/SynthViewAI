import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { StatusCodes } from "http-status-codes";
import { redisClient } from "../config/redis.init.js";
import { RateLimits, type RateLimitKey } from "../constants/ratelimit.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import type { ErrorResponse } from "../types/response.js";

export function createRateLimiter(key: RateLimitKey) {
  const config = RateLimits[key];

  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Authentication must remain available if the distributed counter is
    // temporarily reconnecting. Redis still enforces limits whenever healthy.
    passOnStoreError: true,
    store: new RedisStore({
      sendCommand: ((...args: [string, ...string[]]) => redisClient.call(...args)) as (
        ...args: string[]
      ) => Promise<any>,
      prefix: `rl:${key.toLowerCase()}:`,
    }),
    handler: (_req, res) => {
      const response: ErrorResponse = {
        success: false,
        statusCode: StatusCodes.TOO_MANY_REQUESTS,
        message: "Too many requests, please try again later",
        data: null,
        error: {
          code: ErrorCodes.RATE_LIMIT_EXCEEDED,
        },
      };
      res.status(StatusCodes.TOO_MANY_REQUESTS).json(response);
    },
  });
}
