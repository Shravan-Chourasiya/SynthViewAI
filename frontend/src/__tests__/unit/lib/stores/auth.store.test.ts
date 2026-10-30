import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAuthStore } from '@/lib/stores/auth-store';
import { authService } from '@/lib/services/auth';
import { ApiError } from '@/lib/http';

// Clear store state between tests
function clearAuthStore() {
  useAuthStore.setState({
    user: null,
    pendingEmail: null,
    status: 'unauthenticated',
    error: null,
  });
}

// The store calls through the `authService` object, so the spies have to land
// on that object — spying on the module's named exports does not reach the
// captured references.
function spyOn<K extends keyof typeof authService>(method: K) {
  return vi.spyOn(authService, method);
}

describe('auth.store', () => {
  beforeEach(() => {
    clearAuthStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAuthStore();
  });

  it('should initialize with default state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.pendingEmail).toBeNull();
    expect(state.error).toBeNull();
    expect(['idle', 'unauthenticated']).toContain(state.status);
  });

  it('should set pendingEmail on register', async () => {
    spyOn('register').mockResolvedValue(undefined);

    await useAuthStore.getState().register('John Doe', 'johndoe', 'john@example.com', 'password123');

    const state = useAuthStore.getState();
    expect(state.pendingEmail).toBe('john@example.com');
    expect(state.error).toBeNull();
    expect(authService.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'john@example.com', username: 'johndoe', firstName: 'John' }),
    );
  });

  it('should handle register errors', async () => {
    spyOn('register').mockRejectedValue(new Error('Registration failed'));

    await expect(
      useAuthStore.getState().register('John Doe', 'johndoe', 'john@example.com', 'password123'),
    ).rejects.toThrow('Registration failed');

    expect(useAuthStore.getState().pendingEmail).toBeNull();
  });

  it('should call _clear when logging out', async () => {
    spyOn('logout').mockResolvedValue(undefined);

    useAuthStore.setState({
      user: { id: 'user-123', email: 'john@example.com', name: 'John' } as never,
      status: 'authenticated',
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.status).toBe('unauthenticated');
  });

  it('should handle logout errors gracefully', async () => {
    spyOn('logout').mockRejectedValue(new Error('Network error'));

    useAuthStore.setState({
      user: { id: 'user-123', email: 'john@example.com', name: 'John' } as never,
      status: 'authenticated',
    });

    // Should still clear state even if the network call fails
    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.status).toBe('unauthenticated');
  });

  it('should update state on successful bootstrap', async () => {
    spyOn('me').mockResolvedValue({
      id: 'user-123',
      email: 'john@example.com',
      firstName: 'John',
      username: 'john',
      userrole: 'user',
    } as never);

    await useAuthStore.getState().bootstrap();

    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.user).toMatchObject({
      id: 'user-123',
      email: 'john@example.com',
      // `name` is derived from the first/last name fields the backend returns.
      name: 'John',
    });
  });

  it('should handle bootstrap errors', async () => {
    spyOn('me').mockRejectedValue(new ApiError('INTERNAL', 'Not authenticated', 500));

    await useAuthStore.getState().bootstrap();

    const state = useAuthStore.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.user).toBeNull();
  });

  it('should handle 401 during bootstrap as unauthenticated (not error)', async () => {
    spyOn('me').mockRejectedValue(new ApiError('UNAUTHORIZED', 'Unauthorized', 401));

    await useAuthStore.getState().bootstrap();

    const state = useAuthStore.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.user).toBeNull();
    // A signed-out visitor is not an error condition.
    expect(state.error).toBeNull();
  });

  it('should derive a display name from username when no name fields exist', async () => {
    spyOn('me').mockResolvedValue({
      id: 'user-123',
      email: 'john@example.com',
      username: 'johndoe',
      userrole: 'user',
    } as never);

    await useAuthStore.getState().bootstrap();

    expect(useAuthStore.getState().user?.name).toBe('johndoe');
  });
});
