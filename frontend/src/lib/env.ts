// Single source of truth for all environment variables.
// Nothing else in the codebase may read import.meta.env directly.

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const socketUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
const apiVersion = import.meta.env.VITE_API_VERSION as string | undefined;
const healthCheckIntervalSecondsRaw = import.meta.env
  .VITE_HEALTH_CHECK_INTERVAL_SECONDS as string | undefined;

const DEFAULT_HEALTH_CHECK_INTERVAL_SECONDS = 90;
const MIN_HEALTH_CHECK_INTERVAL_SECONDS = 5;

/**
 * Interval for the silent backend health poll, in seconds.
 *
 * Seconds only — `VITE_HEALTH_CHECK_INTERVAL_SECONDS=90`, never `"90s"` or
 * `"2m"`. A trailing unit would parse as NaN and be ignored, so it is safer to
 * document the single accepted form than to guess at units. `0` disables the
 * poll, anything missing/unparseable falls back to 90, and the value is clamped
 * to a 5 second floor so a typo cannot turn the poll into a request storm.
 */
function parseHealthCheckInterval(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_HEALTH_CHECK_INTERVAL_SECONDS;
  const seconds = Number(raw);
  if (seconds === 0) return 0;
  if (!Number.isFinite(seconds) || seconds < 0) return DEFAULT_HEALTH_CHECK_INTERVAL_SECONDS;
  return Math.max(MIN_HEALTH_CHECK_INTERVAL_SECONDS, Math.floor(seconds));
}

if (!apiBaseUrl) {
  throw new Error(
    "[env] VITE_API_BASE_URL is required. Copy .env.example to .env and set the value.",
  );
}

export const env = Object.freeze({
  /** Base URL of the HTTP API server, no trailing slash. e.g. http://localhost:4000 */
  apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),

  /** Base URL for the Socket.IO connection. Defaults to apiBaseUrl if not set. */
  socketUrl: (socketUrl ?? apiBaseUrl).replace(/\/$/, ""),

  /** Socket.IO server path. */
  socketPath: (import.meta.env.VITE_SOCKET_PATH as string | undefined) ?? "/socket.io",

  /** API version segment, e.g. "api/v1". Stripped of leading/trailing slashes. */
  apiVersion: (apiVersion ?? "api/v1").replace(/^\//, "").replace(/\/$/, ""),

  /**
   * Seconds between silent health polls of the backend, or `0` to disable.
   * Forced to `0` under test so background polling never leaks into a suite.
   */
  healthCheckIntervalSeconds:
    import.meta.env.MODE === "test" ? 0 : parseHealthCheckInterval(healthCheckIntervalSecondsRaw),
});

/** Full HTTP base URL including the API version prefix, e.g. http://localhost:4000/api/v1 */
export const HTTP_BASE_URL = `${env.apiBaseUrl}/${env.apiVersion}`;
