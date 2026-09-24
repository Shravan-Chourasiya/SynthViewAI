/**
 * middleware.test.ts
 * Integration tests for the error handler middleware and 404 handler.
 * Uses a real Express app instance — no DB/Redis required.
 */
import { describe, it, expect, beforeEach, afterEach, type AddressInfo } from "vitest";
import express, { type Express } from "express";
import { StatusCodes } from "http-status-codes";
import type { Server } from "http";
import { errorHandler } from "../src/middlewares/errorHandler.middleware.js";
import { requestIdMiddleware } from "../src/middlewares/requestId.middleware.js";
import { AppError } from "../src/utils/AppError.js";
import { ErrorCodes } from "../src/constants/errorCodes.js";

interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

function startServer(configure: (app: Express) => void = () => {}): Promise<TestServer> {
  return new Promise((resolve) => {
    const app: Express = express();
    app.use(express.json());
    app.use(requestIdMiddleware);

    configure(app);

    app.use((_req, res) => {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        statusCode: StatusCodes.NOT_FOUND,
        message: "Route not found",
        data: null,
        error: { code: ErrorCodes.ROUTE_NOT_FOUND },
      });
    });

    app.use(errorHandler);

    const server: Server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res()))),
      });
    });
  });
}

describe("404 handler", () => {
  let ts: TestServer;
  beforeEach(async () => {
    ts = await startServer();
  });
  afterEach(async () => {
    await ts.close();
  });

  it("returns standard error envelope for unknown route", async () => {
    const res = await fetch(`${ts.baseUrl}/nonexistent`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(StatusCodes.NOT_FOUND);
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(404);
    expect(body.message).toBe("Route not found");
    expect((body.error as { code: string }).code).toBe(ErrorCodes.ROUTE_NOT_FOUND);
  });
});

describe("errorHandler middleware", () => {
  let ts: TestServer;
  afterEach(async () => {
    await ts.close();
  });

  it("maps client-safe AppError to correct status and envelope", async () => {
    ts = await startServer((app) => {
      app.get("/throw", (_req, _res, next) => {
        next(
          new AppError(
            "Invalid credentials",
            StatusCodes.UNAUTHORIZED,
            ErrorCodes.AUTH_INVALID_CREDENTIALS,
            { isOperational: true },
          ),
        );
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(401);
    expect(body.message).toBe("Invalid credentials");
    expect((body.error as { code: string }).code).toBe(ErrorCodes.AUTH_INVALID_CREDENTIALS);
  });

  it("includes details in response when AppError has them", async () => {
    ts = await startServer((app) => {
      app.get("/throw-details", (_req, _res, next) => {
        next(
          new AppError("Validation failed", StatusCodes.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, {
            isOperational: true,
            details: { fields: { email: "Invalid email" } },
          }),
        );
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw-details`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect((body.error as { details: unknown }).details).toEqual({
      fields: { email: "Invalid email" },
    });
  });

  it("sanitizes unexpected errors to generic 500 — no internal message exposed", async () => {
    ts = await startServer((app) => {
      app.get("/throw-uncaught", (_req, _res, next) => {
        next(new Error("PostgreSQL connection refused: ECONNREFUSED 127.0.0.1:5432"));
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw-uncaught`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe("An unexpected error occurred");
    expect((body.error as { code: string }).code).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);
  });

  it("never exposes stack trace to client", async () => {
    ts = await startServer((app) => {
      app.get("/throw-stack", (_req, _res, next) => {
        next(new Error("Something broke"));
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw-stack`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body).not.toHaveProperty("stack");
    expect(JSON.stringify(body)).not.toContain("at ");
  });

  it("never exposes DB details to client", async () => {
    ts = await startServer((app) => {
      app.get("/throw-db", (_req, _res, next) => {
        next(new Error('SQL Error: relation "users" does not exist'));
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw-db`);
    const body = (await res.json()) as Record<string, unknown>;
    const str = JSON.stringify(body).toLowerCase();

    expect(str).not.toContain("sql");
    expect(str).not.toContain("relation");
    expect(str).not.toContain("users");
  });

  it("never exposes Redis details to client", async () => {
    ts = await startServer((app) => {
      app.get("/throw-redis", (_req, _res, next) => {
        next(new Error("Redis connection error: NOAUTH Authentication required"));
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw-redis`);
    const body = (await res.json()) as Record<string, unknown>;
    const str = JSON.stringify(body).toLowerCase();

    expect(str).not.toContain("redis");
    expect(str).not.toContain("noauth");
  });

  it("never exposes filesystem paths to client", async () => {
    ts = await startServer((app) => {
      app.get("/throw-fs", (_req, _res, next) => {
        next(new Error("ENOENT: no such file or directory, open '/etc/passwd'"));
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw-fs`);
    const body = (await res.json()) as Record<string, unknown>;
    const str = JSON.stringify(body);

    expect(str).not.toContain("/etc/passwd");
    expect(str).not.toContain("ENOENT");
  });

  it("5xx AppError is also sanitized — leaky message is not forwarded to client", async () => {
    ts = await startServer((app) => {
      app.get("/throw-5xx-app", (_req, _res, next) => {
        // isOperational defaults to false for 5xx — this is a server-side error
        next(
          new AppError(
            "DB pool exhausted at 127.0.0.1:5432",
            StatusCodes.INTERNAL_SERVER_ERROR,
            ErrorCodes.INTERNAL_SERVER_ERROR,
          ),
        );
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw-5xx-app`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(500);
    expect(body.message).toBe("An unexpected error occurred");
    expect(JSON.stringify(body)).not.toContain("127.0.0.1");
  });
});
