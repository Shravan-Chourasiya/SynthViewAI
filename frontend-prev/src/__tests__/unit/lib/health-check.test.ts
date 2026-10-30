import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startHealthCheck, HEALTH_PROBE_SOURCE } from '@/lib/health-check';
import { env } from '@/lib/env';

// The real env module forces the interval to 0 under test (so a suite can never
// leak background polling), which is exactly what would hide this code from its
// own test. A mutable fake keeps the poll testable.
vi.mock('@/lib/env', () => ({
  env: { apiBaseUrl: 'http://localhost:4000', healthCheckIntervalSeconds: 5 },
}));

const startPolling = () => startHealthCheck();

describe('startHealthCheck', () => {
  const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (env as { healthCheckIntervalSeconds: number }).healthCheckIntervalSeconds = 5;
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('probes /ready immediately and names itself as the caller', async () => {
    const stop = startPolling();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    // The marker is what lets the server's health.probe log name this caller
    // instead of it looking like any other ping.
    expect(url).toBe(`http://localhost:4000/ready?source=${HEALTH_PROBE_SOURCE}`);
    expect(init).toMatchObject({ method: 'GET', credentials: 'omit', cache: 'no-store' });

    await vi.advanceTimersByTimeAsync(0);
    stop();
  });

  it('repeats on the configured interval and stops when cancelled', async () => {
    const stop = startPolling();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('probes again when the tab becomes visible', async () => {
    const stop = startPolling();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Background tabs throttle timers and are discarded under memory pressure, so
    // a returning tab is the moment a probe is most likely overdue.
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    stop();
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('swallows a failing probe instead of surfacing it', async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    const stop = startPolling();

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Still polling — one failure must not stop the keep-alive.
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    stop();
  });

  it('does not poll at all when the interval is disabled', () => {
    (env as { healthCheckIntervalSeconds: number }).healthCheckIntervalSeconds = 0;
    const stop = startPolling();

    expect(fetchMock).not.toHaveBeenCalled();
    stop();
  });
});
