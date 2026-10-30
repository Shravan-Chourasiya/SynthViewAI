import { env } from './env'

/**
 * Marker the API's `health.probe` log uses to name this caller instead of it
 * looking like any other ping.
 */
export const HEALTH_PROBE_SOURCE = 'keepalive'

export function startHealthCheck(): () => void {
  const intervalSeconds = env.healthCheckIntervalSeconds
  if (intervalSeconds <= 0 || typeof fetch !== 'function') return () => {}

  const url = `${env.apiBaseUrl}/ready?source=${HEALTH_PROBE_SOURCE}`
  const TIMEOUT_MS = 10_000
  let stopped = false

  const ping = async () => {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      await fetch(url, { method: 'GET', credentials: 'omit', cache: 'no-store', signal: controller.signal })
    } catch {
      // intentionally silent
    } finally {
      clearTimeout(t)
    }
  }

  const onVisibility = () => {
    if (!stopped && document.visibilityState === 'visible') void ping()
  }
  document.addEventListener('visibilitychange', onVisibility)
  void ping()
  const timer = setInterval(() => { if (!stopped) void ping() }, intervalSeconds * 1000)

  return () => {
    stopped = true
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
