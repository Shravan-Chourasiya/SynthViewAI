import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'
import { HTTP_BASE_URL } from './env'

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details: unknown

  constructor(code: string, message: string, status = 500, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

// ── Internal types ────────────────────────────────────────────────────────────

type RetryableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
  _noRefresh?: boolean
}

type AuthExpiredCallback = () => void
let onAuthExpired: AuthExpiredCallback | undefined
let refreshInFlight: Promise<void> | null = null

// ── CSRF token ────────────────────────────────────────────────────────────────
// The API echoes the CSRF token in the `x-csrf-token` response header on every
// login and refresh. We store it here and attach it to every unsafe request.

let csrfTokenFromResponse: string | null = null

export function setOnAuthExpired(callback: AuthExpiredCallback): void {
  onAuthExpired = callback
}

function getCookie(name: string): string | null {
  const entry = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null
}

function rememberCsrfToken(headers: unknown): void {
  const raw = (headers as Record<string, unknown> | undefined)?.['x-csrf-token']
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value === 'string' && value) csrfTokenFromResponse = value
}

function currentCsrfToken(): string | null {
  return getCookie('csrf_token') ?? csrfTokenFromResponse
}

function isUnsafe(method?: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes((method ?? 'GET').toUpperCase())
}

function canRefresh(config: RetryableConfig): boolean {
  const path = config.url ?? ''
  return (
    !config._noRefresh &&
    path !== '/auth/refresh' &&
    !path.startsWith('/auth/')
  )
}

function toApiError(error: unknown): ApiError {
  const axiosError = error as AxiosError<{
    message?: string
    error?: { code?: string; details?: unknown }
  }>
  const response = axiosError.response
  const body = response?.data
  return new ApiError(
    body?.error?.code ?? `HTTP_${response?.status ?? 500}`,
    body?.message ?? axiosError.message ?? 'Request failed',
    response?.status ?? 500,
    body?.error?.details,
  )
}

function unwrap<T>(response: { data: unknown }): T {
  const payload = response.data
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'success' in payload &&
    (payload as Record<string, unknown>).success === true &&
    'data' in payload
  ) {
    return (payload as { data: T }).data
  }
  return payload as T
}

// ── Axios instances ───────────────────────────────────────────────────────────

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: HTTP_BASE_URL,
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

const refreshClient = axios.create({
  baseURL: HTTP_BASE_URL,
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

// ── Request interceptor — attach CSRF token ───────────────────────────────────

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (isUnsafe(config.method)) {
    const csrf = currentCsrfToken()
    if (csrf) config.headers.set('X-CSRF-Token', csrf)
  }
  return config
})

// ── Response interceptor — silent refresh on 401 ─────────────────────────────

axiosInstance.interceptors.response.use(
  (response) => {
    rememberCsrfToken(response.headers)
    return response
  },
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined
    if (
      error.response?.status === 401 &&
      config &&
      !config._retry &&
      canRefresh(config)
    ) {
      config._retry = true
      try {
        if (!refreshInFlight) {
          refreshInFlight = refreshClient
            .post('/auth/refresh')
            .then((res) => rememberCsrfToken(res.headers))
            .finally(() => {
              refreshInFlight = null
            })
        }
        await refreshInFlight
        return axiosInstance.request(config)
      } catch {
        onAuthExpired?.()
      }
    }
    return Promise.reject(toApiError(error))
  },
)

// ── HTTP helpers ──────────────────────────────────────────────────────────────

export function httpGet<T>(path: string): Promise<T> {
  return axiosInstance.get(path).then(unwrap<T>)
}

/** Like httpGet but a 401 will NOT trigger a silent token refresh.
 *  Used by bootstrap so a missing session never causes a reload loop. */
export function httpGetNoRefresh<T>(path: string): Promise<T> {
  return axiosInstance
    .get(path, { _noRefresh: true } as RetryableConfig)
    .then(unwrap<T>)
}

export function httpPost<T>(path: string, body?: unknown): Promise<T> {
  return axiosInstance.post(path, body).then(unwrap<T>)
}

export function httpPut<T>(path: string, body?: unknown): Promise<T> {
  return axiosInstance.put(path, body).then(unwrap<T>)
}

export function httpPatch<T>(path: string, body?: unknown): Promise<T> {
  return axiosInstance.patch(path, body).then(unwrap<T>)
}

export function httpDelete<T>(path: string): Promise<T> {
  return axiosInstance.delete(path).then(unwrap<T>)
}
