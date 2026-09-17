import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api } from '@/lib/api';
import * as authService from '@/lib/services/auth.service';
import * as interviewService from '@/lib/services/interview.service';
import { normalizeInterview } from '@/lib/normalizers/interview';
import { ApiError } from '@/lib/http';

// Mock the services that api module depends on
vi.mock('@/lib/services/auth.service');
vi.mock('@/lib/services/interview.service');
vi.mock('@/lib/normalizers/interview');

describe('api.ts module - Priority 2 tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Auth facade methods', () => {
    it('should call login service and normalize user response', async () => {
      const mockLoginData = { email: 'test@example.com', password: 'password', deviceType: 'desktop' };
      const mockUserData = { id: '1', email: 'test@example.com', firstName: 'Test', lastName: 'User', createdAt: new Date().toISOString(), userrole: 'candidate' };
      
      vi.spyOn(authService, 'login').mockResolvedValue(undefined);
      vi.spyOn(authService, 'me').mockResolvedValue(mockUserData);
      
      const result = await api.login('test@example.com', 'password');
      
      expect(authService.login).toHaveBeenCalledWith(mockLoginData);
      expect(authService.me).toHaveBeenCalled();
    });

    it('should call register service with normalized name', async () => {
      const mockRegisterData = { 
        email: 'test@example.com', 
        password: 'password', 
        username: 'testuser',
        firstName: 'John',
        lastName: 'Doe'
      };
      
      vi.spyOn(authService, 'register').mockResolvedValue(undefined);
      
      await api.register('John Doe', 'testuser', 'test@example.com', 'password');
      
      expect(authService.register).toHaveBeenCalledWith(mockRegisterData);
    });

    it('should call me service and normalize response', async () => {
      const mockUserData = { id: '1', email: 'test@example.com', firstName: 'Test', lastName: 'User', createdAt: new Date().toISOString(), userrole: 'candidate' };
      
      vi.spyOn(authService, 'me').mockResolvedValue(mockUserData);
      
      const result = await api.me();
      
      expect(authService.me).toHaveBeenCalled();
    });

    it('should call logout service', async () => {
      vi.spyOn(authService, 'logout').mockResolvedValue(undefined);
      
      await api.logout();
      
      expect(authService.logout).toHaveBeenCalled();
    });
  });

  describe('Interview facade methods', () => {
    it('should call listInterviews service and normalize responses', async () => {
      const mockRawInterviews = [
        { id: '1', status: 'CREATED', title: 'Test Interview' },
        { id: '2', status: 'INPROGRESS', title: 'Another Interview' }  // Keep as INPROGRESS
      ];
      const mockNormalizedInterviews = [
        { id: '1', status: 'CREATED', title: 'Test Interview', userId: 'user1' },
        { id: '2', status: 'IN_PROGRESS', title: 'Another Interview', userId: 'user1' }  // Will be normalized to IN_PROGRESS
      ];
      
      vi.spyOn(interviewService, 'listInterviews').mockResolvedValue(mockRawInterviews);
      vi.mocked(normalizeInterview).mockImplementation((input) => {
        // Simulate the actual normalization behavior
        const normalized = { ...input, userId: 'user1' } as any;
        if (normalized.status === 'INPROGRESS') {
          normalized.status = 'IN_PROGRESS'; // This is how the normalizer actually works
        }
        return normalized;
      });
      
      const result = await api.listInterviews();
      
      expect(interviewService.listInterviews).toHaveBeenCalled();
      expect(normalizeInterview).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockNormalizedInterviews);
    });

    it('should call getInterview service and normalize response', async () => {
      const mockRawInterview = { id: '1', status: 'CREATED', title: 'Test Interview' };
      const mockNormalizedInterview = { id: '1', status: 'CREATED', title: 'Test Interview', userId: 'user1' };
      
      vi.spyOn(interviewService, 'getInterview').mockResolvedValue(mockRawInterview);
      vi.mocked(normalizeInterview).mockImplementation((input) => {
        return { ...input, userId: 'user1' } as any;
      });
      
      const result = await api.getInterview('1');
      
      expect(interviewService.getInterview).toHaveBeenCalledWith('1');
      expect(normalizeInterview).toHaveBeenCalledWith(mockRawInterview);
      expect(result).toEqual(mockNormalizedInterview);
    });

    it('should return null for INTERVIEW_NOT_FOUND error', async () => {
      const mockError = new ApiError('INTERVIEW_NOT_FOUND', 'Interview not found', 404);
      
      vi.spyOn(interviewService, 'getInterview').mockRejectedValue(mockError);
      
      const result = await api.getInterview('invalid-id');
      
      expect(result).toBeNull();
    });

    it('should call createInterview service', async () => {
      const mockConfig = { 
        roleTitle: 'Engineer', 
        domain: 'Engineering', 
        experienceLevel: 'Mid-level',
        difficulty: 'Medium',
        type: 'Technical',
        topics: ['JavaScript'],
        durationMin: 30,
        interviewStyle: 'REGULAR',
        endingCriteria: 'DURATION'
      };
      const mockResponse = { id: 'new-123', interviewId: '' };
      
      vi.spyOn(interviewService, 'createInterview').mockResolvedValue(mockResponse);
      
      const result = await api.createInterview(mockConfig);
      
      expect(interviewService.createInterview).toHaveBeenCalledWith(mockConfig);
      expect(result).toBe('new-123');
    });

    it('should call getReport service and normalize response', async () => {
      const mockReportData = { 
        interviewId: '123', 
        overallScore: '85', 
        technicalScore: '80',
        communicationScore: '90',
        problemSolvingScore: '85',
        confidenceScore: '80',
        feedback: 'Good performance'
      };
      const mockHistoryData = { 
        questions: [
          { 
            questionTitle: 'Test question', 
            questionType: 'TECHNICAL', 
            answerData: 'Test answer',
            evaluationData: { score: 85, feedback: 'Good answer' } 
          }
        ]
      };
      
      vi.spyOn(interviewService, 'getInterviewReport').mockResolvedValue(mockReportData);
      vi.spyOn(interviewService, 'getInterviewHistory').mockResolvedValue(mockHistoryData);
      
      const result = await api.getReport('123');
      
      expect(interviewService.getInterviewReport).toHaveBeenCalledWith('123');
      expect(interviewService.getInterviewHistory).toHaveBeenCalledWith('123');
    });
  });

  describe('Session facade methods', () => {
    it('should call listSessions service and normalize responses', async () => {
      const mockRawSessions = [
        { id: '1', deviceType: 'desktop', ipAddress: '127.0.0.1', createdAt: new Date().toISOString(), isActive: true, isRevoked: false, isExpired: false }
      ];
      
      vi.spyOn(authService, 'sessions').mockResolvedValue(mockRawSessions);
      
      const result = await api.listSessions();
      
      expect(authService.sessions).toHaveBeenCalled();
    });

    it('should call revokeSession service', async () => {
      vi.spyOn(authService, 'revokeSession').mockResolvedValue(undefined);
      
      await api.revokeSession('session-123');
      
      expect(authService.revokeSession).toHaveBeenCalledWith('session-123');
    });
  });

  describe('Profile facade methods', () => {
    it('should call updateProfile service with normalized name', async () => {
      const mockUser = { name: 'John Doe', id: '1' };
      const mockResponse = { id: '1', firstName: 'John', lastName: 'Doe', email: 'john@example.com', createdAt: new Date().toISOString(), userrole: 'candidate' };
      
      vi.spyOn(authService, 'updateProfile').mockResolvedValue(mockResponse);
      
      const result = await api.updateProfile(mockUser);
      
      expect(authService.updateProfile).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe'
      });
    });

    it('should call changePassword service', async () => {
      const mockUserResponse = { id: '1', email: 'test@example.com', firstName: 'Test', lastName: 'User', createdAt: new Date().toISOString(), userrole: 'candidate' };
      
      vi.spyOn(authService, 'me').mockResolvedValue(mockUserResponse);
      vi.spyOn(authService, 'updatePassword').mockResolvedValue(undefined);
      
      await api.changePassword('oldpass', 'newpass');
      
      expect(authService.me).toHaveBeenCalled();
      expect(authService.updatePassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        currentPassword: 'oldpass',
        newPassword: 'newpass'
      });
    });
  });
});