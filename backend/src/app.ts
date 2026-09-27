import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { StatusCodes } from "http-status-codes";
import { env } from "./config/env.js";
import { requestLogger } from "./utils/logger.js";
import { requestIdMiddleware } from "./middlewares/requestId.middleware.js";
import { ErrorCodes } from "./constants/errorCodes.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import getPgDb from "./db/postgres.init.js";
import { config } from "dotenv";
import { corsOptions } from "./constants/cors.js";
import { csrfTokenEcho, csrfTokenMiddleware } from "./middlewares/csrf.middleware.js";
import { sql } from "drizzle-orm";
import { redisClient } from "./config/redis.init.js";
import { readinessCheck } from "./utils/ready.js";
import { createInterviewRouter } from "./routes/interview.routes.js";
import { startAbandonStaleInterviewsJob } from "./jobs/abandonStaleInterviews.job.js";
import { startInterviewReminderJob } from "./jobs/interviewReminder.job.js";
import AdminRoutes from "./routes/admin.routes.js";
import AnalyticsRoutes from "./routes/analytics.routes.js";
import { createNotificationRouter } from "./routes/notification.routes.js";
import { createContactRouter } from "./routes/contact.routes.js";
config();
const app = express();

// Render terminates TLS at its edge and forwards the request to this process over
// loopback, so without this every `req.ip` is the proxy's own address (`::1`).
// That single fact used to appear in the "new sign-in" alert email as the client
// IP, and it also collapses every rate-limit bucket into one global counter.
// One hop is exactly right here: the edge is the only proxy in front of the app.
// It stays unset in development, where requests arrive directly from the browser.
if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

//****************************************** Database Connection ******************************************//
const dbConn = getPgDb();

//****************************************** Middleware Configuration ******************************************//
app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: "184kb" }));
app.use(cookieParser());
app.use(csrfTokenEcho);
app.use(express.urlencoded({ extended: true, limit: "184kb" }));
app.use(requestIdMiddleware);
app.use(requestLogger);

//****************************************** Route Registration ******************************************//
const AuthRoutes: express.Router = createAuthRouter();
app.use(`/${env.API_VERSION}/`, AuthRoutes);
const InterviewRoutes: express.Router = createInterviewRouter();
app.use(`/${env.API_VERSION}/`, InterviewRoutes);

// Register admin and analytics routes
app.use(`/${env.API_VERSION}/admin`, AdminRoutes);
app.use(`/${env.API_VERSION}/analytics`, AnalyticsRoutes);
app.use(`/${env.API_VERSION}/`, createNotificationRouter());
app.use(`/${env.API_VERSION}/`, createContactRouter());

startAbandonStaleInterviewsJob();
startInterviewReminderJob();

//****************************************** Health Check Endpoints ******************************************//
app.get("/health", (_req, res) => {
  res.status(StatusCodes.OK).json({ status: "OK" });
});

app.get("/ping", (_req, res) => {
  res.status(StatusCodes.OK).json({ status: "OK", ping: "pong" });
});

app.get("/ready", async (req, res) => {
  const { statusCode, checks, healthy } = await readinessCheck(dbConn, redisClient);
  res.status(statusCode).json({ status: healthy ? "OK" : "DEGRADED", checks });
});

app.get("/version", (req, res) => {
  res.status(StatusCodes.OK).json({ status: "OK" });
});

//****************************************** 404 Handler ******************************************//
app.use((_req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    status: "error",
    statusCode: StatusCodes.NOT_FOUND,
    message: "Route not found",
    error: {
      code: ErrorCodes.ROUTE_NOT_FOUND,
    },
  });
});

//****************************************** Error Handling Middleware ******************************************//
app.use(errorHandler);

//****************************************** Export the Express App ******************************************//
export default app;
