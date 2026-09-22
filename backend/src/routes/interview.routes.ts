import express from "express";
import { createRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { csrfTokenMiddleware } from "../middlewares/csrf.middleware.js";
import { requireOwnership } from "../middlewares/ownership.middleware.js";
import { validateBody, validateParams } from "../middlewares/zodValidator.middleware.js";
import {
  interviewIdParamSchema,
  revokeShareSchema,
  shareTokenParamSchema,
} from "../modules/interview/zodschemas/share.zschema.js";
import { requireInterviewState } from "../modules/interview/middlewares/interviewState.middleware.js";
import { createInterviewSchema } from "../modules/interview/zodschemas/interview.zschema.js";
import {
  createInterviewController,
  getAllInterviewsController,
  getInterviewByIdController,
  deleteInterviewController,
  getInterviewMetricsController,
  getInterviewHistoryController,
  getInterviewReportController,
  getResumableInterviewsController,
  startInterviewController,
  pauseInterviewController,
  resumeInterviewController,
  cancelInterviewController,
  endInterviewController,
  submitAnswerController,
  createShareLinkController,
  getSharedReportController,
  revokeShareLinkController,
} from "../modules/interview/controller/interview.controller.js";
import { fetchInterviewById } from "../modules/interview/services/interview.service.js";

const InterviewLimiter = createRateLimiter("INTERVIEW");
const CreateInterviewLimiter = createRateLimiter("CREATE_INTERVIEW");
// Unauthenticated and token-guessable: stricter than the authed limiter.
const ShareLimiter = createRateLimiter("SHARE");

const requireInterviewOwnership = requireOwnership(
  fetchInterviewById,
  (interview) => interview.userId,
);

export function createInterviewRouter() {
  const router = express.Router();

  router.post(
    "/interviews",
    requireAuth,
    csrfTokenMiddleware,
    CreateInterviewLimiter,
    validateBody(createInterviewSchema),
    createInterviewController,
  );

  router.get(
    "/interviews",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    getAllInterviewsController,
  );

  router.get(
    "/interviews/resumable",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    getResumableInterviewsController,
  );

  router.get(
    "/interviews/:id",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    requireInterviewOwnership,
    getInterviewByIdController,
  );

  router.get(
    "/interviews/:id/history",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    requireInterviewOwnership,
    getInterviewHistoryController,
  );

  router.get(
    "/interviews/:id/metrics",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    requireInterviewOwnership,
    getInterviewMetricsController,
  );

  router.get(
    "/interviews/:id/report",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    requireInterviewOwnership,
    getInterviewReportController,
  );

  router.delete(
    "/interviews/:id",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    requireInterviewOwnership,
    deleteInterviewController,
  );

  router.post(
    "/interviews/:id/start",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    requireInterviewOwnership,
    requireInterviewState("READY", "SCHEDULED"),
    startInterviewController,
  );

  router.post(
    "/interviews/:id/pause",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    requireInterviewOwnership,
    pauseInterviewController,
  );

  router.post(
    "/interviews/:id/resume",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    requireInterviewOwnership,
    resumeInterviewController,
  );

  router.post(
    "/interviews/:id/cancel",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    requireInterviewOwnership,
    cancelInterviewController,
  );

  router.post(
    "/interviews/:id/end",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    requireInterviewOwnership,
    endInterviewController,
  );

  router.post(
    "/interviews/:id/questions/:questionId/answer",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    requireInterviewOwnership,
    submitAnswerController,
  );

  // ── Report share links ────────────────────────────────────────────────────
  // Create/revoke are owner actions (auth + CSRF); the public read is
  // intentionally unauthenticated but heavily rate-limited.
  router.post(
    "/interviews/:id/share",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    validateParams(interviewIdParamSchema),
    createShareLinkController,
  );

  router.post(
    "/interviews/:id/share/revoke",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    validateParams(interviewIdParamSchema),
    validateBody(revokeShareSchema),
    revokeShareLinkController,
  );

  router.get(
    "/interviews/shared/:token",
    ShareLimiter,
    validateParams(shareTokenParamSchema),
    getSharedReportController,
  );

  return router;
}
