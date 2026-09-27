import { env } from "../config/env.js";

interface CorsOptions {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => void;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
}
const allowedOrigins = env.CORS_ORIGIN;

if (env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  throw new Error(
    "CORS_ORIGIN must be set in production — refusing to start with no allowed origins",
  );
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // no Origin header (server-to-server, curl) — decide deliberately, don't default-allow
    if (!origin) return callback(null, false);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV === "development" && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true, // required if you're sending cookies cross-origin
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  // The API echoes the caller's CSRF cookie in this header (see
  // middlewares/csrf.middleware.ts). Cross-site, `document.cookie` cannot read
  // that cookie, so the SPA has no other way to learn the token — and browsers
  // hide non-simple response headers unless they are exposed here. Only origins
  // allowed by `origin` above can read it, so an attacker page still cannot.
  exposedHeaders: ["X-CSRF-Token"],
};
