import type { RequestHandler } from "express";
import { COOKIE_NAMES } from "../constants/auth.constants.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Echo the caller's CSRF cookie back in a response header on every request.
 *
 * Double-submit CSRF needs the SPA to *know* the token before it can send it as
 * `X-CSRF-Token`. Reading it from `document.cookie` only works when frontend and
 * API share an origin: cross-site (https://*.vercel.app -> https://*.onrender.com)
 * the cookie belongs to the API origin and JavaScript on the frontend origin
 * cannot see it. Response headers are readable only by origins allowed in the
 * CORS config (see `exposedHeaders` in constants/cors.ts), so an attacker page
 * cannot learn the value this way — the guarantee of the scheme is unchanged.
 *
 * Controllers that rotate the token (`login`, `refresh`) overwrite this header
 * with the *new* value via `setAuthCookies`, so the client is never left with a
 * token that no longer matches its cookie.
 */
export const csrfTokenEcho: RequestHandler = (req, res, next) => {
  const cookies = (req.cookies ?? {}) as Record<string, unknown>;
  const csrfToken = cookies[COOKIE_NAMES.CSRF];
  if (typeof csrfToken === "string" && csrfToken) {
    res.setHeader("X-CSRF-Token", csrfToken);
  }
  next();
};

export const csrfTokenMiddleware: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const csrfToken = req.cookies[COOKIE_NAMES.CSRF];
  const csrfHeader = req.headers["x-csrf-token"] || req.headers["x-xsrf-token"];

  if (!csrfToken || !csrfHeader) {
    return res.status(403).json({ error: "Invalid or missing CSRF token" });
  }
  if (csrfToken !== csrfHeader) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  next();
};
