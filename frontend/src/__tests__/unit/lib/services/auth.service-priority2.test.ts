import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { httpGet, httpPost, httpPatch, httpDelete } from '@/lib/http';
import { 
  register,
  verifyOtp,
  login,
  refresh,
  logout,
  me,
  sessions,
  revokeSession,
  revokeAllSessions,
  recoverAccount,
  recoverAccountVerify,
  forgotPassword,
  forgotPasswordVerify,
  updatePassword,
  updateEmail,
  updateEmailVerify,
  updateProfile,
  deleteAccount
} from '@/lib/services/auth.service';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/node';

const API_BASE_URL = 'http://localhost:4000/api/v1';

// Mock the http functions to track calls
vi.mock('@/lib/http', async () => {
  const actual = await vi.importActual('@/lib/http');
  return {
    ...actual,
    httpGet: vi.fn(),
    httpPost: vi.fn(),
    httpPatch: vi.fn(),
    httpDelete: vi.fn(),
  };
});

describe('auth.service.ts - Priority 2 tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Registration and Verification', () => {
    it('should call register endpoint with correct parameters', async () => {
      const mockBody = { 
        email: 'test@example.com', 
        password: 'password123', 
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User'
      };
      
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await register(mockBody);
      
      expect(httpPost).toHaveBeenCalledWith('/auth/register', mockBody);
    });

    it('should call verifyOtp endpoint with correct parameters', async () => {
      const mockBody = { email: 'test@example.com', otp: '123456' };
      
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await verifyOtp(mockBody);
      
      expect(httpPost).toHaveBeenCalledWith('/auth/verify-otp', mockBody);
    });
  });

  describe('Authentication', () => {
    it('should call login endpoint with correct parameters', async () => {
      const mockBody = { 
        email: 'test@example.com', 
        password: 'password123', 
        deviceType: 'desktop' 
      };
      
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await login(mockBody);
      
      expect(httpPost).toHaveBeenCalledWith('/auth/login', mockBody);
    });

    it('should call refresh endpoint', async () => {
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await refresh();
      
      expect(httpPost).toHaveBeenCalledWith('/auth/refresh');
    });

    it('should call logout endpoint', async () => {
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await logout();
      
      expect(httpPost).toHaveBeenCalledWith('/usr/logout');
    });
  });

  describe('User Profile', () => {
    it('should call me endpoint', async () => {
      const mockResponse = { id: '1', email: 'test@example.com', firstName: 'Test', lastName: 'User' };
      
      vi.mocked(httpGet).mockResolvedValue(mockResponse);
      
      const result = await me();
      
      expect(httpGet).toHaveBeenCalledWith('/usr/me');
      expect(result).toEqual(mockResponse);
    });

    it('should call updateProfile endpoint with correct parameters', async () => {
      const mockBody = { firstName: 'Updated', lastName: 'Name' };
      const mockResponse = { id: '1', email: 'test@example.com', firstName: 'Updated', lastName: 'Name' };
      
      vi.mocked(httpPatch).mockResolvedValue(mockResponse);
      
      const result = await updateProfile(mockBody);
      
      expect(httpPatch).toHaveBeenCalledWith('/usr/profile', mockBody);
      expect(result).toEqual(mockResponse);
    });

    it('should call deleteAccount endpoint', async () => {
      vi.mocked(httpDelete).mockResolvedValue(undefined);
      
      await deleteAccount();
      
      expect(httpDelete).toHaveBeenCalledWith('/usr/account');
    });
  });

  describe('Sessions', () => {
    it('should call sessions endpoint', async () => {
      const mockResponse = [
        { id: '1', deviceType: 'desktop', ipAddress: '127.0.0.1', createdAt: new Date().toISOString(), isActive: true }
      ];
      
      vi.mocked(httpGet).mockResolvedValue(mockResponse);
      
      const result = await sessions();
      
      expect(httpGet).toHaveBeenCalledWith('/usr/sessions');
      expect(result).toEqual(mockResponse);
    });

    it('should call revokeSession endpoint with correct ID', async () => {
      vi.mocked(httpDelete).mockResolvedValue(undefined);
      
      await revokeSession('session-123');
      
      expect(httpDelete).toHaveBeenCalledWith('/usr/session/session-123');
    });

    it('should call revokeAllSessions endpoint', async () => {
      vi.mocked(httpDelete).mockResolvedValue(undefined);
      
      await revokeAllSessions();
      
      expect(httpDelete).toHaveBeenCalledWith('/usr/sessions');
    });
  });

  describe('Account Recovery and Password Management', () => {
    it('should call recoverAccount endpoint with correct parameters', async () => {
      const mockBody = { email: 'test@example.com', otp: '123456', newPassword: 'newPassword123' };
      
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await recoverAccount(mockBody);
      
      expect(httpPost).toHaveBeenCalledWith('/auth/recover-account', mockBody);
    });

    it('should call recoverAccountVerify endpoint with correct parameters', async () => {
      const mockBody = { email: 'test@example.com', otp: '123456', newPassword: 'newPassword123' };
      
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await recoverAccountVerify(mockBody);
      
      expect(httpPost).toHaveBeenCalledWith('/auth/recover-account/verify', mockBody);
    });

    it('should call forgotPassword endpoint with correct parameters', async () => {
      const mockBody = { email: 'test@example.com' };
      
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await forgotPassword(mockBody);
      
      expect(httpPost).toHaveBeenCalledWith('/auth/forgot-password', mockBody);
    });

    it('should call forgotPasswordVerify endpoint with correct parameters', async () => {
      const mockBody = { 
        email: 'test@example.com', 
        otp: '123456', 
        newPassword: 'newPassword123',
        confirmPassword: 'newPassword123'
      };
      
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await forgotPasswordVerify(mockBody);
      
      expect(httpPost).toHaveBeenCalledWith('/auth/forgot-password/verify', mockBody);
    });

    it('should call updatePassword endpoint with correct parameters', async () => {
      const mockBody = { 
        email: 'test@example.com', 
        currentPassword: 'oldPassword', 
        newPassword: 'newPassword' 
      };
      
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await updatePassword(mockBody);
      
      expect(httpPost).toHaveBeenCalledWith('/usr/update-password', mockBody);
    });

    it('should call updateEmail endpoint with correct parameters', async () => {
      const mockBody = { newEmail: 'new@example.com' };
      
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await updateEmail(mockBody);
      
      expect(httpPost).toHaveBeenCalledWith('/usr/update-email', mockBody);
    });

    it('should call updateEmailVerify endpoint with correct parameters', async () => {
      const mockBody = { email: 'test@example.com', otp: '123456' };
      
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await updateEmailVerify(mockBody);
      
      expect(httpPost).toHaveBeenCalledWith('/usr/update-email/verify', mockBody);
    });
  });
});