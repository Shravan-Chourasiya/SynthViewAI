import {
  detectAndAbandonStaleInterviews,
  detectAndTimeoutStaleQuestions,
  detectAndTimeoutOverdueInterviews,
  detectAndExpireScheduledInterviews,
} from "../modules/interview/services/interview.service.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const JOB_INTERVAL_MS = 15 * 60 * 1000; // run every 15 minutes

async function runInterviewMaintenanceSweep(): Promise<void> {
  try {
    // 1. Per-question timeout — mark PENDING questions on inactive interviews as TIMED_OUT
    const { timedOut: questionsTimedOut } = await detectAndTimeoutStaleQuestions();
    if (questionsTimedOut > 0) {
      logger.info(`[job] interviewMaintenance: timed out ${questionsTimedOut} question(s)`);
    }

    // 2. Overall interview duration — transition overdue INPROGRESS interviews to TIMED_OUT
    const { timedOut: interviewsTimedOut } = await detectAndTimeoutOverdueInterviews();
    if (interviewsTimedOut > 0) {
      logger.info(
        `[job] interviewMaintenance: timed out ${interviewsTimedOut} interview(s) by duration`,
      );
    }

    // 3. Stale abandonment — mark long-inactive INPROGRESS interviews as ABANDONED
    const { abandoned } = await detectAndAbandonStaleInterviews();
    if (abandoned > 0) {
      logger.info(`[job] interviewMaintenance: abandoned ${abandoned} stale interview(s)`);
    }

    const { expired } = await detectAndExpireScheduledInterviews();
    if (expired > 0) {
      logger.info(`[job] interviewMaintenance: expired ${expired} scheduled interview(s)`);
    }
  } catch (err) {
    logger.error({ err }, "[job] interviewMaintenance: failed");
  }
}

/**
 * Sweeps interviews that were left mid-flight: timed-out questions, timed-out
 * interviews, abandoned sessions and expired scheduled slots.
 *
 * Runs once immediately as well as on the interval. Every check here is
 * time-threshold based, so anything already stale at boot should be reconciled
 * as soon as the process is up rather than up to 15 minutes later — and in
 * development `tsx watch` restarts reset the interval on each file save, which
 * could otherwise postpone the sweep indefinitely. Skipped under NODE_ENV=test,
 * where importing `app.ts` must not mutate the fixtures other suites assert on.
 */
export function startAbandonStaleInterviewsJob(): NodeJS.Timeout {
  logger.info("[job] interviewMaintenance: started");

  if (env.NODE_ENV !== "test") {
    void runInterviewMaintenanceSweep();
  }

  return setInterval(() => {
    void runInterviewMaintenanceSweep();
  }, JOB_INTERVAL_MS);
}
