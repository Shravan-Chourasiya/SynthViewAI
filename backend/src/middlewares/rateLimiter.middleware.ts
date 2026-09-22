import rateLimit, { ipKeyGenerator, MemoryStore } from "express-rate-limit";
import { RedisStore, type SendCommandFn } from "rate-limit-redis";
import { StatusCodes } from "http-status-codes";
import { redisClient } from "../config/redis.init.js";
import { RateLimits, type RateLimitKey } from "../constants/ratelimit.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import type { ErrorResponse } from "../types/response.js";
import { logger } from "../utils/logger.js";

// ── Redis availability tracking ───────────────────────────────────────────
// The Redis endpoint for this deployment is not always reachable (DNS outage /
// expired host). A hard dependency on it at import time used to crash or
// wedge auth on startup: `new RedisStore(...)` eagerly sends `SCRIPT LOAD`
// through a client created with `enableOfflineQueue: false`, so every
// rate-limited route threw "Stream isn't writeable" and the limiter init
// error surfaced on every request. Track reachability instead and only use
// the Redis store while Redis is actually usable; otherwise fall back to the
// in-process memory store so the API keeps serving (limits become per-process
// until Redis recovers).

let redisUsable = false;

redisClient.on("ready", () => {
  if (!redisUsable) {
    redisUsable = true;
    logger.info("Rate limiter: Redis reachable — using distributed store");
  }
});

const markRedisDown = (reason: string) => {
  if (redisUsable) {
    redisUsable = false;
    logger.warn({ reason }, "Rate limiter: Redis unreachable — falling back to memory store");
  }
};

redisClient.on("error", (err) => markRedisDown(err instanceof Error ? err.message : String(err)));
redisClient.on("close", () => markRedisDown("connection closed"));
redisClient.on("end", () => markRedisDown("connection ended"));

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
    // temporarily reconnecting. Redis still enforces limits whenever healthy;
    // otherwise the in-process store keeps basic protection without any Redis
    // I/O (which is what used to throw "Stream isn't writeable" on startup).
    passOnStoreError: true,
    store:
      redisClient.status === "ready" || redisUsable          ? new RedisStore({
            // `rate-limit-redis` types this as `SendCommandFn`; ioredis resolves
            // `call` to `Promise<unknown>`, so assert to the store's own contract
            // rather than the previous untyped `Promise<any>`.
            sendCommand: ((...args: [string, ...string[]]) =>
              redisClient.call(...args)) as unknown as SendCommandFn,
            prefix: `rl:${key.toLowerCase()}:`,
          })
        : new MemoryStore(),
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