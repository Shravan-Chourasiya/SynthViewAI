import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const redisConfig = {
  // This deployment keeps credentials in REDIS_PASSWORD rather than in
  // REDIS_URI, so use the explicit connection fields.
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
  retryStrategy(times: number) {
    // Returning null permanently closes the ioredis client. Rate-limit-redis
    // then attempts to use that closed client and turns auth requests into 500s.
    // Keep retrying with a bounded backoff instead.
    return Math.min(times * 200, 2000);
  },
  // Redis Cloud endpoint in this environment does not support ioredis v6's
  // default RESP3 negotiation (`HELLO 3`). Use the broadly supported RESP2
  // protocol to prevent the connect/error loop.
  protocol: 2 as const,
  // This managed Redis endpoint rejects INFO, which ioredis otherwise sends
  // as a ready check after every connection. A successful TCP/auth connection
  // is sufficient for this client.
  enableReadyCheck: false,
  // Let consumers fail promptly while Redis reconnects. The rate limiter is
  // explicitly configured to fail open for that transient infrastructure fault.
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
};

const redisClient = new Redis(redisConfig);

redisClient.on("connect", () => logger.info("Redis connected"));
redisClient.on("error", (err) => logger.error({ cause: err }, "Redis error"));

export { redisClient };
