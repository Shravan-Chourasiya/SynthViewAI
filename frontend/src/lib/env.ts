const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined
const socketUrl = import.meta.env.VITE_SOCKET_URL as string | undefined
const apiVersion = import.meta.env.VITE_API_VERSION as string | undefined
const rawInterval = import.meta.env.VITE_HEALTH_CHECK_INTERVAL_SECONDS as string | undefined

if (!apiBaseUrl) {
  throw new Error('[env] VITE_API_BASE_URL is required. Copy .env.example to .env and set the value.')
}

function parseInterval(raw: string | undefined): number {
  if (!raw || raw.trim() === '') return 90
  const n = Number(raw)
  if (n === 0) return 0
  if (!Number.isFinite(n) || n < 0) return 90
  return Math.max(5, Math.floor(n))
}

export const env = Object.freeze({
  apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
  socketUrl: (socketUrl ?? apiBaseUrl).replace(/\/$/, ''),
  socketPath: (import.meta.env.VITE_SOCKET_PATH as string | undefined) ?? '/socket.io',
  apiVersion: (apiVersion ?? 'api/v1').replace(/^\//, '').replace(/\/$/, ''),
  healthCheckIntervalSeconds: import.meta.env.MODE === 'test' ? 0 : parseInterval(rawInterval),
})

export const HTTP_BASE_URL = `${env.apiBaseUrl}/${env.apiVersion}`
