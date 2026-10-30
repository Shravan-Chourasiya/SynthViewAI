import { ENDPOINTS } from "./constants/endpoints";
import { env } from "./env";

/**
 * Silent liveness poll against the backend's readiness probe.
 *
 * `GET /ready` is the endpoint that actually checks the whole stack — it pings
 * Postgres (`select 1`) and Redis (`ping`) and answers `503` with a `checks` map
 * when either is down, while a plain `GET /health` only proves the HTTP process
 * is up. Polling it on a timer is enough to keep the API warm (Render's free
 * plan spins the instance down after ~15 minutes idle, and a cold start is
 * exactly the slow first request a user would otherwise hit) and to leave an
 * uptime trail in the browser's network tab.
 *
 * Deliberately silent: no UI, no toast, no console output on failure. A sleeping
 * instance, an offline laptop or a stopped dev server is not an error worth
 * telling a signed-out visitor about, and the poll must never interfere with the
 * session (no cookies, no CSRF header, no axios interceptors — which also means
 * a 401/503 here can never trigger the token-refresh flow).
 *
 * The query marker exists so the *server* log can name the caller: the backend
 * logs a `health.probe` line per probe, and without it a browser keep-alive is
 * indistinguishable from Render's own checks or a manual curl. A simple GET with
 * a query string stays a CORS "simple request" — adding a header instead would
 * buy the same thing at the cost of an OPTIONS preflight per poll.
 *
 * @returns stop function — cancels the pending timer. Safe to call twice.
 */
export const HEALTH_PROBE_SOURCE = "keepalive";

export function startHealthCheck(): () => void {
  const intervalSeconds = env.healthCheckIntervalSeconds;
  // `typeof fetch` guard: the poll is best-effort by design, so a host without
  // fetch (older jsdom, a stripped test env) simply does not poll.
  if (intervalSeconds <= 0 || typeof fetch !== "function") {
    return () => {
      // Nothing to stop — the poll never started.
    };
  }

  const url = `${env.apiBaseUrl}${ENDPOINTS.system.ready}?source=${HEALTH_PROBE_SOURCE}`;
  const REQUEST_TIMEOUT_MS = 10_000;
  let stopped = false;

  const ping = async (): Promise<void> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      await fetch(url, {
        method: "GET",
        // No cookies: the probe is public, and sending a session cookie would
        // make the request cross-site credentialed for no reason.
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
      });
    } catch {
      // Intentionally swallowed — see the doc comment.
    } finally {
      clearTimeout(timeout);
    }
  };

  // Coming back to a backgrounded tab is exactly when the instance is most likely
  // asleep: browsers throttle timers in background tabs (a 120 s interval can
  // drift far past that) and discard them outright under memory pressure. Probing
  // on return warms the API before the first click rather than during it, which is
  // the whole point of the poll.
  const onVisibilityChange = () => {
    if (!stopped && document.visibilityState === "visible") void ping();
  };
  const listensForVisibility = typeof document !== "undefined";
  if (listensForVisibility) document.addEventListener("visibilitychange", onVisibilityChange);

  void ping();
  const timer = setInterval(() => {
    if (!stopped) void ping();
  }, intervalSeconds * 1000);

  return () => {
    stopped = true;
    clearInterval(timer);
    if (listensForVisibility) {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}
