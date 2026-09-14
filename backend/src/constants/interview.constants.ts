// Keep this in sync with frontend/src/pages/interviews/new.tsx until this curated list
// is exposed by a backend configuration endpoint; update both locations together.
export const TARGET_COMPANIES = [
  "Google",
  "Microsoft",
  "Amazon",
  "Meta",
  "Apple",
  "Netflix",
  "OpenAI",
  "Nvidia",
  "TCS",
  "Infosys",
  "JPMorgan",
  "Wipro",
  "Deloitte",
  "Adobe",
  "Anthropic",
];

// Abandonment criteria (finalised criteria TBD — using 90 min inactivity for now)
export const ABANDONMENT_THRESHOLD_MS = 90 * 60 * 1000; // 90 minutes

// Per-question timeout — 5 minutes, on expiry question is marked TIMED_OUT and scored 0
export const QUESTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
