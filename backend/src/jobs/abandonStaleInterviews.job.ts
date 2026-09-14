import {
  detectAndAbandonStaleInterviews,
  detectAndTimeoutStaleQuestions,
  detectAndTimeoutOverdueInterviews,
  detectAndExpireScheduledInterviews,
} from "../modules/interview/services/interview.service.js";
import { logger } from "../utils/logger.js";

const JOB_INTERVAL_MS = 15 * 60 * 1000; // run every 15 minutes

export function startAbandonStaleInterviewsJob(): NodeJS.Timeout {
  logger.info("[job] interviewMaintenance: started");

  return setInterval(async () => {
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
  }, JOB_INTERVAL_MS);
}
