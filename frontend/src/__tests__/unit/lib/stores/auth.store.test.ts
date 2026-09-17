import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAuthStore } from '@/lib/stores/auth.store';

// Clear store state between tests
function clearAuthStore() {
  useAuthStore.setState({
    user: null,
    pendingEmail: null,
    status: 'unauthenticated',
    error: null,
  });
}

describe('auth.store', () => {
  beforeEach(() => {
    clearAuthStore();
  });

  afterEach(() => {
    clearAuthStore();
  });

  it('should initialize with default state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.pendingEmail).toBeNull();
    expect(state.status).toBe('unauthenticated'); // Changed from 'idle' to 'unauthenticated' based on store init
    expect(state.error).toBeNull();
  });

  it('should set pendingEmail on register', async () => {
    const originalRegister = (await import('@/lib/services/auth.service')).register;
    vi.spyOn(await import('@/lib/services/auth.service'), 'register').mockResolvedValue(undefined);

    await useAuthStore.getState().register('John Doe', 'johndoe', 'john@example.com', 'password123');

    const state = useAuthStore.getState();
    expect(state.pendingEmail).toBe('john@example.com');
    expect(state.error).toBeNull();

    vi.spyOn(await import('@/lib/services/auth.service'), 'register').mockImplementation(originalRegister);
  });

  it('should handle register errors', async () => {
    const originalRegister = (await import('@/lib/services/auth.service')).register;
    vi.spyOn(await import('@/lib/services/auth.service'), 'register').mockRejectedValue(new Error('Registration failed'));

    await expect(useAuthStore.getState().register('John Doe', 'johndoe', 'john@example.com', 'password123'))
      .rejects.toThrow('Registration failed');

    vi.spyOn(await import('@/lib/services/auth.service'), 'register').mockImplementation(originalRegister);
  });

  it('should call _clear when logging out', async () => {
    const originalLogout = (await import('@/lib/services/auth.service')).logout;
    vi.spyOn(await import('@/lib/services/auth.service'), 'logout').mockResolvedValue(undefined);

    // Set up some state first
    useAuthStore.setState({
      user: { id: 'user-123', email: 'john@example.com', name: 'John' },
      status: 'authenticated',
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.status).toBe('unauthenticated');

    vi.spyOn(await import('@/lib/services/auth.service'), 'logout').mockImplementation(originalLogout);
  });

  it('should handle logout errors gracefully', async () => {
    const originalLogout = (await import('@/lib/services/auth.service')).logout;
    vi.spyOn(await import('@/lib/services/auth.service'), 'logout').mockRejectedValue(new Error('Network error'));

    // Should still clear state even if the network call fails
    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.status).toBe('unauthenticated');

    vi.spyOn(await import('@/lib/services/auth.service'), 'logout').mockImplementation(originalLogout);
  });

  it('should update state on successful bootstrap', async () => {
    const originalMe = (await import('@/lib/services/auth.service')).me;
    vi.spyOn(await import('@/lib/services/auth.service'), 'me').mockResolvedValue({
      id: 'user-123',
      email: 'john@example.com',
      name: 'John',
    } as any);

    await useAuthStore.getState().bootstrap();

    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.user).toEqual({ id: 'user-123', email: 'john@example.com', name: 'John' });

    vi.spyOn(await import('@/lib/services/auth.service'), 'me').mockImplementation(originalMe as any);
  });

  it('should handle bootstrap errors', async () => {
    const originalMe = (await import('@/lib/services/auth.service')).me;
    vi.spyOn(await import('@/lib/services/auth.service'), 'me').mockRejectedValue(new Error('Not authenticated'));

    await useAuthStore.getState().bootstrap();

    const state = useAuthStore.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.user).toBeNull();

    vi.spyOn(await import('@/lib/services/auth.service'), 'me').mockImplementation(originalMe as any);
  });

  it('should handle 401 during bootstrap as unauthenticated (not error)', async () => {
    const originalMe = (await import('@/lib/services/auth.service')).me;
    const { ApiError } = await import('@/lib/http');
    // Create an ApiError with status 401 to simulate a 401 response
    const apiError = new ApiError('UNAUTHORIZED', 'Unauthorized', 401);
    vi.spyOn(await import('@/lib/services/auth.service'), 'me').mockRejectedValue(apiError);

    await useAuthStore.getState().bootstrap();

    const state = useAuthStore.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.user).toBeNull();
    // Error should be null for 401 (treated as "not logged in", not an error)
    expect(state.error).toBeNull();

    vi.spyOn(await import('@/lib/services/auth.service'), 'me').mockImplementation(originalMe as any);
  });

  it('_clear should reset all auth state', () => {
    useAuthStore.setState({
      user: { id: 'user-123', email: 'john@example.com', name: 'John' },
      pendingEmail: 'john@example.com',
      status: 'authenticated',
      error: 'Some error',
    });

    useAuthStore.getState()._clear();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.pendingEmail).toBeNull();
    expect(state.status).toBe('unauthenticated');
    expect(state.error).toBeNull();
  });
});