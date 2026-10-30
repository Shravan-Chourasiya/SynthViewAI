import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { httpGet, httpPost } from '@/lib/http';
import { 
  listInterviews,
  resumableInterviews,
  createInterview,
  getInterview,
  getInterviewHistory,
  getInterviewMetrics,
  getInterviewReport,
  startInterview,
  pauseInterview,
  resumeInterview,
  cancelInterview,
  endInterview,
  submitAnswer
} from '@/lib/services/interview.service';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/node';

// Mock the http functions to track calls
vi.mock('@/lib/http', async () => {
  const actual = await vi.importActual('@/lib/http');
  return {
    ...actual,
    httpGet: vi.fn(),
    httpPost: vi.fn(),
  };
});

describe('interview.service.ts - Priority 2 tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('List and Fetch Operations', () => {
    it('should call listInterviews endpoint', async () => {
      const mockResponse = [
        { id: '1', title: 'Test Interview', status: 'CREATED' },
        { id: '2', title: 'Another Interview', status: 'INPROGRESS' }
      ];
      
      vi.mocked(httpGet).mockResolvedValue(mockResponse);
      
      const result = await listInterviews();
      
      expect(httpGet).toHaveBeenCalledWith('/interviews');
      expect(result).toEqual(mockResponse);
    });

    it('should call resumableInterviews endpoint', async () => {
      const mockResponse = [
        { id: '1', title: 'Resumable Interview', status: 'PAUSED' }
      ];
      
      vi.mocked(httpGet).mockResolvedValue(mockResponse);
      
      const result = await resumableInterviews();
      
      expect(httpGet).toHaveBeenCalledWith('/interviews/resumable');
      expect(result).toEqual(mockResponse);
    });

    it('should call getInterview endpoint with correct ID', async () => {
      const mockResponse = { id: '123', title: 'Specific Interview', status: 'CREATED' };
      
      vi.mocked(httpGet).mockResolvedValue(mockResponse);
      
      const result = await getInterview('123');
      
      expect(httpGet).toHaveBeenCalledWith('/interviews/123');
      expect(result).toEqual(mockResponse);
    });

    it('should call getInterviewHistory endpoint with correct ID', async () => {
      const mockResponse = [
        { id: 'event-1', type: 'question_delivered', label: 'Question 1', detail: 'First question', at: new Date().toISOString() }
      ];
      
      vi.mocked(httpGet).mockResolvedValue(mockResponse);
      
      const result = await getInterviewHistory('123');
      
      expect(httpGet).toHaveBeenCalledWith('/interviews/123/history');
      expect(result).toEqual(mockResponse);
    });

    it('should call getInterviewMetrics endpoint with correct ID', async () => {
      const mockResponse = { 
        activeSeconds: 1800, 
        report: { overallScore: 85, questionsAnswered: 5, totalDuration: 1800 } 
      };
      
      vi.mocked(httpGet).mockResolvedValue(mockResponse);
      
      const result = await getInterviewMetrics('123');
      
      expect(httpGet).toHaveBeenCalledWith('/interviews/123/metrics');
      expect(result).toEqual(mockResponse);
    });

    it('should call getInterviewReport endpoint with correct ID', async () => {
      const mockResponse = { 
        interviewId: '123', 
        overallScore: 85, 
        technicalScore: 80,
        communicationScore: 90
      };
      
      vi.mocked(httpGet).mockResolvedValue(mockResponse);
      
      const result = await getInterviewReport('123');
      
      expect(httpGet).toHaveBeenCalledWith('/interviews/123/report');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('CRUD Operations', () => {
    it('should call createInterview endpoint with correct parameters', async () => {
      const mockConfig = {
        roleTitle: 'Software Engineer',
        domain: 'Technology',
        experienceLevel: 'Mid-level',
        difficulty: 'Medium',
        type: 'Technical',
        topics: ['JavaScript', 'React'],
        durationMin: 60,
        interviewStyle: 'REGULAR',
        endingCriteria: 'DURATION'
      };
      const mockResponse = { id: 'new-456', interviewId: 'new-456' };
      
      vi.mocked(httpPost).mockResolvedValue(mockResponse);
      
      const result = await createInterview(mockConfig);
      
      expect(httpPost).toHaveBeenCalledWith('/interviews', {
        jobrole: 'Software Engineer',
        domain: 'Technology',
        experience: 'mid-level',
        jobSkills: ['JavaScript', 'React'],
        difficulty: 'MEDIUM',
        isAdaptive: false,
        interviewStyle: 'REGULAR',
        interviewType: 'TECHNICAL',
        duration: 60,
        isScheduled: false,
        endingCriteria: 'DURATION'
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle Adaptive difficulty in createInterview', async () => {
      const mockConfig = {
        roleTitle: 'Senior Developer',
        domain: 'Engineering',
        experienceLevel: 'Senior',
        difficulty: 'Adaptive',
        type: 'Mixed',
        topics: ['Node.js', 'TypeScript'],
        durationMin: 45,
        interviewStyle: 'FAANG',
        endingCriteria: 'DURATION'
      };
      const mockResponse = { id: 'new-789', interviewId: 'new-789' };
      
      vi.mocked(httpPost).mockResolvedValue(mockResponse);
      
      const result = await createInterview(mockConfig);
      
      expect(httpPost).toHaveBeenCalledWith('/interviews', {
        jobrole: 'Senior Developer',
        domain: 'Engineering',
        experience: 'senior',
        jobSkills: ['Node.js', 'TypeScript'],
        difficulty: 'MEDIUM', // This is correct - when difficulty is Adaptive, the API still uses MEDIUM
        isAdaptive: true, // This flag indicates it's adaptive
        interviewStyle: 'FAANG',
        interviewType: 'MIXED',
        duration: 45,
        isScheduled: false,
        endingCriteria: 'DURATION'
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle Behavioral type in createInterview', async () => {
      const mockConfig = {
        roleTitle: 'Product Manager',
        domain: 'Product',
        experienceLevel: 'Mid-level',
        difficulty: 'Hard',
        type: 'Behavioral',
        topics: ['Leadership', 'Strategy'],
        durationMin: 30,
        interviewStyle: 'REGULAR',
        endingCriteria: 'DURATION'
      };
      const mockResponse = { id: 'new-000', interviewId: 'new-000' };
      
      vi.mocked(httpPost).mockResolvedValue(mockResponse);
      
      const result = await createInterview(mockConfig);
      
      expect(httpPost).toHaveBeenCalledWith('/interviews', {
        jobrole: 'Product Manager',
        domain: 'Product',
        experience: 'mid-level',
        jobSkills: ['Leadership', 'Strategy'],
        difficulty: 'HARD', // Should be HARD when difficulty is Hard
        isAdaptive: false,
        interviewStyle: 'REGULAR',
        interviewType: 'BEHAVIORAL', // Should be BEHAVIORAL when type is Behavioral
        duration: 30,
        isScheduled: false,
        endingCriteria: 'DURATION'
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Interview Lifecycle Operations', () => {
    it('should call startInterview endpoint with correct ID', async () => {
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await startInterview('123');
      
      expect(httpPost).toHaveBeenCalledWith('/interviews/123/start');
    });

    it('should call pauseInterview endpoint with correct ID', async () => {
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await pauseInterview('123');
      
      expect(httpPost).toHaveBeenCalledWith('/interviews/123/pause');
    });

    it('should call resumeInterview endpoint with correct ID', async () => {
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await resumeInterview('123');
      
      expect(httpPost).toHaveBeenCalledWith('/interviews/123/resume');
    });

    it('should call cancelInterview endpoint with correct ID', async () => {
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await cancelInterview('123');
      
      expect(httpPost).toHaveBeenCalledWith('/interviews/123/cancel');
    });

    it('should call endInterview endpoint with correct ID', async () => {
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await endInterview('123');
      
      expect(httpPost).toHaveBeenCalledWith('/interviews/123/end');
    });
  });

  describe('Answer Submission', () => {
    it('should call submitAnswer endpoint with correct parameters', async () => {
      const mockBody = {
        questionId: 'q-123',
        answerType: 'TEXT',
        answerData: 'This is my answer'
      };
      
      vi.mocked(httpPost).mockResolvedValue(undefined);
      
      await submitAnswer('interview-456', mockBody);
      
      expect(httpPost).toHaveBeenCalledWith('/interviews/interview-456/questions/q-123/answer', mockBody);
    });
  });
});