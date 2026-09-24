import {
  detectAndSendInterviewReminders,
  detectAndSendPausedInterviewReminders,
} from "../modules/interview/services/interview.service.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const JOB_INTERVAL_MS = 15 * 60 * 1000; // run every 15 minutes

async function runInterviewReminderSweep(): Promise<void> {
  try {
    const { reminders24h, reminders1h } = await detectAndSendInterviewReminders();
    if (reminders24h + reminders1h > 0) {
      logger.info(
        `[job] interviewReminders: queued ${reminders24h} 24h and ${reminders1h} 1h reminder(s)`,
      );
    }

    const { reminders } = await detectAndSendPausedInterviewReminders();
    if (reminders > 0) {
      logger.info(`[job] interviewReminders: queued ${reminders} paused-interview reminder(s)`);
    }
  } catch (err) {
    logger.error({ err }, "[job] interviewReminders: failed");
  }
}

/**
 * In-process job that queues the small set of interview reminder emails: the
 * ≈24h and ≈1h reminders for scheduled interviews, plus the single follow-up
 * for an interview that has sat paused for more than 24h.
 *
 * Follows the `setInterval` shape of `abandonStaleInterviews.job.ts` — there is
 * no cron/queue library in this codebase. Dedupe timestamps on the interview row
 * (stamped inside the detection functions) guarantee each reminder is sent once.
 *
 * The sweep also runs once immediately: reminders are window-based (an interview
 * entering the 24h or 1h window), so waiting a full interval to look at the very
 * first window would delay every reminder by up to 15 minutes. In development
 * `tsx watch` restarts the process on each file save, which resets the interval —
 * without the up-front run the sweep could be postponed indefinitely. Skipped
 * under NODE_ENV=test, where importing `app.ts` must not fire reminders at the
 * fixtures other suites are asserting on.
 */
export function startInterviewReminderJob(): NodeJS.Timeout {
  logger.info("[job] interviewReminders: started");

  if (env.NODE_ENV !== "test") {
    void runInterviewReminderSweep();
  }

  return setInterval(() => {
    void runInterviewReminderSweep();
  }, JOB_INTERVAL_MS);
}
