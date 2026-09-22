import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { redisClient } from "../config/redis.init.js";
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  REFRESH_TOKEN_TTL_SECONDS,
  SHARE_TOKEN_TTL,
} from "../constants/auth.constants.js";
export { COOKIE_NAMES } from "../constants/auth.constants.js";

export interface TokenPayload {
  userId: string;
  sessionId: string;
  tokenFamily: string;
  type: "access" | "refresh";
}

/** Payload carried by a report share-link token. No session fields — a share
 * token never authenticates a user, it only names one interview. */
export interface ShareTokenPayload {
  interviewId: string;
  type: "share";
}

export function signAccessToken(payload: Omit<TokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "access" }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(payload: Omit<TokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "refresh" }, env.JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

export function signShareToken(payload: Omit<ShareTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "share" }, env.JWT_SECRET, { expiresIn: SHARE_TOKEN_TTL });
}

/** Verifies a share token and rejects anything that is valid JWT but not a
 * share token (access/refresh tokens must not open share links). Throws on
 * any failure — callers map that to a 404-style response. */
export function verifyShareToken(token: string): ShareTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as ShareTokenPayload;
  if (payload.type !== "share" || typeof payload.interviewId !== "string") {
    throw new jwt.JsonWebTokenError("not a share token");
  }
  return payload;
}

export async function blacklistToken(token: string): Promise<void> {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  const ttl = decoded?.exp
    ? decoded.exp - Math.floor(Date.now() / 1000)
    : REFRESH_TOKEN_TTL_SECONDS;
  if (ttl > 0) {
    await redisClient.setex(`bl:${token}`, ttl, "1");
  }
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const result = await redisClient.exists(`bl:${token}`);
  return result === 1;
}
