import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { HTTP_BASE_URL } from "./env";
import { ENDPOINTS } from "./constants/endpoints";
import type { ErrorCode } from "./types/api";

export class ApiError extends Error {
  readonly code: ErrorCode | string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode | string, message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };
type AuthExpiredCallback = () => void;
let onAuthExpired: AuthExpiredCallback | undefined;
let refreshInFlight: Promise<void> | null = null;

// The CSRF token as published by the API on the last login/refresh response.
// Deployed, the frontend (*.vercel.app) and the API (*.onrender.com) are
// different sites: the csrf cookie is owned by the API origin, so
// `document.cookie` on this origin cannot read it and the request interceptor
// has nothing to copy into `X-CSRF-Token`. The API therefore echoes the token in
// an exposed response header, and this is where it is remembered for the tab.
let csrfTokenFromResponse: string | null = null;

export function setOnAuthExpired(callback: AuthExpiredCallback): void {
  onAuthExpired = callback;
}

function getCookie(name: string): string | null {
  const entry = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

/** Keep the last token the API handed back (login and refresh both send one). */
function rememberCsrfToken(headers: unknown): void {
  const raw = (headers as Record<string, unknown> | undefined)?.["x-csrf-token"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === "string" && value) csrfTokenFromResponse = value;
}

/** Same-origin reads the cookie; cross-site falls back to the echoed token. */
function currentCsrfToken(): string | null {
  return getCookie("csrf_token") ?? csrfTokenFromResponse;
}

function isUnsafe(method?: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes((method ?? "GET").toUpperCase());
}

function canRefresh(url?: string): boolean {
  const path = url ?? "";
  return path !== ENDPOINTS.auth.refresh && !path.startsWith("/auth/");
}

function toApiError(error: unknown): ApiError {
  const axiosError = error as AxiosError<{
    message?: string;
    error?: { code?: string; details?: unknown };
  }>;
  const response = axiosError.response;
  const body = response?.data;
  return new ApiError(
    body?.error?.code ?? `HTTP_${response?.status ?? 500}`,
    body?.message ?? axiosError.message ?? "Request failed",
    response?.status ?? 500,
    body?.error?.details,
  );
}

function unwrap<T>(response: { data: unknown }): T {
  const payload = response.data;
  if (
    payload !== null &&
    typeof payload === "object" &&
    "success" in payload &&
    (payload as Record<string, unknown>).success === true &&
    "data" in payload
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: HTTP_BASE_URL,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

const refreshClient = axios.create({
  baseURL: HTTP_BASE_URL,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (isUnsafe(config.method)) {
    const csrf = currentCsrfToken();
    if (csrf) config.headers.set("X-CSRF-Token", csrf);
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => {
    rememberCsrfToken(response.headers);
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    if (error.response?.status === 401 && config && !config._retry && canRefresh(config.url)) {
      config._retry = true;
      try {
        if (!refreshInFlight) {
          refreshInFlight = refreshClient
            .post(ENDPOINTS.auth.refresh)
            // Refresh rotates the CSRF token; capture the new one or every
            // mutating request after a silent refresh would 403.
            .then((response) => rememberCsrfToken(response.headers))
            .finally(() => {
              refreshInFlight = null;
            });
        }
        await refreshInFlight;
        return axiosInstance.request(config);
      } catch {
        onAuthExpired?.();
      }
    }
    const apiError = toApiError(error);
    return Promise.reject(apiError);
  },
);

export function httpGet<T>(path: string): Promise<T> {
  return axiosInstance.get(path).then(unwrap<T>);
}

export function httpPost<T>(path: string, body?: unknown): Promise<T> {
  return axiosInstance.post(path, body).then(unwrap<T>);
}

export function httpPut<T>(path: string, body?: unknown): Promise<T> {
  return axiosInstance.put(path, body).then(unwrap<T>);
}

export function httpPatch<T>(path: string, body?: unknown): Promise<T> {
  return axiosInstance.patch(path, body).then(unwrap<T>);
}

export function httpDelete<T>(path: string): Promise<T> {
  return axiosInstance.delete(path).then(unwrap<T>);
}
