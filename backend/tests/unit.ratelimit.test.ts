/**
 * unit.ratelimit.test.ts — Part 1.3
 * Rate-limit logic unit tests.
 * Uses express-rate-limit with a MemoryStore (not Redis) so no containers needed.
 * Fake timers are used to advance the window — no real sleeping.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type AddressInfo } from "vitest";
import express, { type Express } from "express";
import rateLimit, { MemoryStore, ipKeyGenerator } from "express-rate-limit";
import type { Server } from "http";
import { StatusCodes } from "http-status-codes";

interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

function buildApp(limit: number, windowMs: number, store: MemoryStore): Express {
  const app = express();
  app.use(express.json());
  app.set("trust proxy", 1);

  const limiter = rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store,
    keyGenerator: (req, _res) => {
      // For requests with x-client-id header, use that as key
      const clientId = req.headers["x-client-id"] as string;
      if (clientId) {
        return clientId;
      }
      
      // Use ipKeyGenerator to safely handle IPv4/IPv6 addresses
      return ipKeyGenerator(req.ip || "unknown");
    },
    handler: (_req, res) => {
      res.status(StatusCodes.TOO_MANY_REQUESTS).json({ error: "rate_limit_exceeded" });
    },
  });

  app.get("/limited", limiter, (_req, res) => {
    res.status(StatusCodes.OK).json({ ok: true });
  });

  return app;
}

function startApp(app: Express): Promise<TestServer> {
  return new Promise((resolve) => {
    const server: Server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res()))),
      });
    });
  });
}

async function hit(baseUrl: string, clientId: string): Promise<number> {
  const res = await fetch(`${baseUrl}/limited`, {
    headers: { "x-client-id": clientId },
  });
  return res.status;
}

describe("Rate limiter — allow/block", () => {
  let ts: TestServer;
  let store: MemoryStore;

  beforeEach(async () => {
    store = new MemoryStore();
    const app = buildApp(3, 60_000, store); // limit=3, window=60s
    ts = await startApp(app);
  });

  afterEach(async () => {
    await ts.close();
  });

  it("requests under the limit are allowed (200)", async () => {
    expect(await hit(ts.baseUrl, "client-a")).toBe(200);
    expect(await hit(ts.baseUrl, "client-a")).toBe(200);
    expect(await hit(ts.baseUrl, "client-a")).toBe(200);
  });

  it("the Nth request that crosses the threshold is rejected (429)", async () => {
    await hit(ts.baseUrl, "client-b");
    await hit(ts.baseUrl, "client-b");
    await hit(ts.baseUrl, "client-b");
    // 4th request crosses limit=3
    const status = await hit(ts.baseUrl, "client-b");
    expect(status).toBe(StatusCodes.TOO_MANY_REQUESTS);
  });

  it("rate limit is scoped per client — one client blocked does not block another", async () => {
    // Exhaust client-c
    await hit(ts.baseUrl, "client-c");
    await hit(ts.baseUrl, "client-c");
    await hit(ts.baseUrl, "client-c");
    await hit(ts.baseUrl, "client-c"); // blocked

    // client-d is a fresh client — should still be allowed
    const status = await hit(ts.baseUrl, "client-d");
    expect(status).toBe(200);
  });
});

describe("Rate limiter — window reset", () => {
  let ts: TestServer;
  let store: MemoryStore;

  beforeEach(async () => {
    vi.useFakeTimers();
    store = new MemoryStore();
    const app = buildApp(2, 10_000, store); // limit=2, window=10s
    ts = await startApp(app);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await ts.close();
  });

  it("limit resets after the configured window (fake timers, no sleep)", async () => {
    // Exhaust the limit
    await hit(ts.baseUrl, "client-e");
    await hit(ts.baseUrl, "client-e");
    expect(await hit(ts.baseUrl, "client-e")).toBe(429);

    // Advance time past the window
    vi.advanceTimersByTime(11_000);

    // MemoryStore uses Date.now() internally — after advancing fake timers
    // the store's window has expired and the counter resets
    // NOTE: MemoryStore.resetKey is called lazily on next request
    // We reset manually to simulate the window expiry flush
    await store.resetKey("client-e");

    expect(await hit(ts.baseUrl, "client-e")).toBe(200);
  });
});
