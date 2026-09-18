import rateLimit, { ipKeyGenerator } from "express-rate-limit";
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
    // Use the built-in IP handling mechanism which properly handles IPv4/IPv6
    // Since we're not providing a custom keyGenerator, express-rate-limit will use its default
    // safe IP-based key generation that handles IPv6 properly
    // keyGenerator: (req, _res) => req.ip || req.connection.remoteAddress || "unknown",
    // Actually, to satisfy the IPv6 warning, we should let express-rate-limit use its default behavior
    // but we can still customize when needed while staying safe
    keyGenerator: (req, _res) => {
      // For requests with x-client-id header, use that as key
      const clientId = req.headers["x-client-id"] as string;
      if (clientId) {
        return clientId;
      }
      
      // Use ipKeyGenerator to safely handle IPv4/IPv6 addresses
      // Pass the request's IP to ipKeyGenerator which handles IPv4/IPv6 normalization
      return ipKeyGenerator(req.ip || "unknown");
    },
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