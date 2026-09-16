import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/lib/stores/auth.store';
import * as authService from '@/lib/services/auth.service';
import { ApiError } from '@/lib/http';

// Mock the auth service module only
vi.mock('@/lib/services/auth.service');

describe('auth.store', () => {
  beforeEach(() => {
    // Reset the store before each test by setting initial state
    useAuthStore.setState({
      user: null,
      pendingEmail: null,
      status: "idle",
      error: null,
    });
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with correct default values', () => {
      const state = useAuthStore.getState();
      
      expect(state.user).toBeNull();
      expect(state.pendingEmail).toBeNull();
      expect(state.status).toBe('idle');
      expect(state.error).toBeNull();
    });
  });

  describe('bootstrap', () => {
    it('should set loading status and fetch user data when authenticated', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
      vi.spyOn(authService, 'me').mockResolvedValue(mockUser);

      const { bootstrap } = useAuthStore.getState();
      await bootstrap();

      const state = useAuthStore.getState();
      expect(state.status).toBe('authenticated');
      expect(state.user).toEqual(mockUser);
      expect(state.error).toBeNull();
    });

    it('should handle unauthenticated state', async () => {
      vi.spyOn(authService, 'me').mockRejectedValue(new Error('Unauthorized'));

      const { bootstrap } = useAuthStore.getState();
      await bootstrap();

      const state = useAuthStore.getState();
      expect(state.status).toBe('unauthenticated');
      expect(state.user).toBeNull();
      expect(state.error).toBeNull(); // 401 errors should not set error state
    });

    it('should handle non-401 API errors during bootstrap', async () => {
      // Create an actual ApiError instance with status 500 and message
      const apiError = new ApiError('NETWORK_ERROR', 'Network error', 500);
      
      vi.spyOn(authService, 'me').mockRejectedValue(apiError);

      const { bootstrap } = useAuthStore.getState();
      await bootstrap();

      const state = useAuthStore.getState();
      expect(state.status).toBe('unauthenticated');
      expect(state.error).toBe('Network error'); // Expect the message, not the status
    });
  });

  describe('login', () => {
    it('should successfully login and set user data', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
      vi.spyOn(authService, 'login').mockResolvedValue(undefined);
      vi.spyOn(authService, 'me').mockResolvedValue(mockUser);

      const { login } = useAuthStore.getState();
      await login('test@example.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.status).toBe('authenticated');
      expect(state.user).toEqual(mockUser);
      expect(state.error).toBeNull();
    });

    it('should handle login errors', async () => {
      const loginError = new Error('Invalid credentials');
      vi.spyOn(authService, 'login').mockRejectedValue(loginError);

      const { login } = useAuthStore.getState();
      
      await expect(login('test@example.com', 'wrongpass')).rejects.toThrow('Invalid credentials');

      const state = useAuthStore.getState();
      expect(state.status).toBe('unauthenticated');
      expect(state.error).toBe('Invalid credentials');
    });
  });

  describe('register', () => {
    it('should set pendingEmail after successful registration', async () => {
      vi.spyOn(authService, 'register').mockResolvedValue(undefined);

      const { register } = useAuthStore.getState();
      await register('Test User', 'testuser', 'test@example.com', 'password123');

      const state = useAuthStore.getState();
      expect(authService.register).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User'
      });
      expect(state.pendingEmail).toBe('test@example.com');
      expect(state.error).toBeNull();
    });

    it('should handle registration errors', async () => {
      const regError = new Error('Registration failed');
      vi.spyOn(authService, 'register').mockRejectedValue(regError);

      const { register } = useAuthStore.getState();
      
      await expect(register('Test User', 'testuser', 'test@example.com', 'password123')).rejects.toThrow('Registration failed');

      const state = useAuthStore.getState();
      expect(state.error).toBeNull(); // Error is not set in register action
    });
  });

  describe('verifyOtp', () => {
    it('should successfully verify OTP', async () => {
      vi.spyOn(authService, 'verifyOtp').mockResolvedValue(undefined);

      const { verifyOtp } = useAuthStore.getState();
      await verifyOtp('test@example.com', '123456');

      // VerifyOtp should not change state, just call the service
      expect(authService.verifyOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        otp: '123456'
      });
    });

    it('should handle OTP verification errors', async () => {
      const otpError = new Error('Invalid OTP');
      vi.spyOn(authService, 'verifyOtp').mockRejectedValue(otpError);

      const { verifyOtp } = useAuthStore.getState();
      
      await expect(verifyOtp('test@example.com', 'invalid')).rejects.toThrow('Invalid OTP');
    });
  });

  describe('logout', () => {
    it('should clear auth state after logout', async () => {
      // First set some state to clear
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
      useAuthStore.setState({
        user: mockUser,
        status: 'authenticated',
        pendingEmail: 'test@example.com'
      });

      vi.spyOn(authService, 'logout').mockResolvedValue(undefined);

      const { logout } = useAuthStore.getState();
      await logout();

      const state = useAuthStore.getState();
      expect(authService.logout).toHaveBeenCalled();
      expect(state.user).toBeNull();
      expect(state.status).toBe('unauthenticated');
      expect(state.pendingEmail).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('_clear', () => {
    it('should reset auth state to unauthenticated', () => {
      // Set some state to clear
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
      useAuthStore.setState({
        user: mockUser,
        status: 'authenticated',
        pendingEmail: 'test@example.com',
        error: 'Some error'
      });

      const { _clear } = useAuthStore.getState();
      _clear();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.status).toBe('unauthenticated');
      expect(state.pendingEmail).toBeNull();
      expect(state.error).toBeNull();
    });
  });
});