import { describe, it, expect } from 'vitest';
import { normalizeInterview } from '@/lib/normalizers/interview';

describe('interview normalizer - Priority 2 tests', () => {
  describe('normalizeStatus function', () => {
    it('should map INPROGRESS to IN_PROGRESS', () => {
      const input = { status: 'INPROGRESS' as const };
      const result = normalizeInterview(input as any);
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should map DRAFT to CREATED', () => {
      const input = { status: 'DRAFT' as const };
      const result = normalizeInterview(input as any);
      expect(result.status).toBe('CREATED');
    });

    it('should map SCHEDULED to READY', () => {
      const input = { status: 'SCHEDULED' as const };
      const result = normalizeInterview(input as any);
      expect(result.status).toBe('READY');
    });

    it('should map TIMED_OUT to ABANDONED', () => {
      const input = { status: 'TIMED_OUT' as const };
      const result = normalizeInterview(input as any);
      expect(result.status).toBe('ABANDONED');
    });

    it('should map EXPIRED to EXPIRED', () => {
      const input = { status: 'EXPIRED' as const };
      const result = normalizeInterview(input as any);
      expect(result.status).toBe('EXPIRED');
    });

    it('should pass through other statuses as-is', () => {
      const input = { status: 'COMPLETED' as const };
      const result = normalizeInterview(input as any);
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('normalizeDifficulty function', () => {
    it('should normalize "easy" to Easy', () => {
      const input = { 
        status: 'CREATED' as const,
        interviewDifficulty: 'easy',
        interviewMetaData: {}
      };
      const result = normalizeInterview(input as any);
      expect(result.difficulty).toBe('Easy');
    });

    it('should normalize "hard" to Hard', () => {
      const input = { 
        status: 'CREATED' as const,
        interviewDifficulty: 'hard',
        interviewMetaData: {}
      };
      const result = normalizeInterview(input as any);
      expect(result.difficulty).toBe('Hard');
    });

    it('should normalize "adaptive" to Adaptive', () => {
      const input = { 
        status: 'CREATED' as const,
        interviewDifficulty: 'adaptive',
        interviewMetaData: { isAdaptive: true }
      };
      const result = normalizeInterview(input as any);
      expect(result.difficulty).toBe('Adaptive');
    });

    it('should default to Medium', () => {
      const input = { 
        status: 'CREATED' as const,
        interviewMetaData: {}
      };
      const result = normalizeInterview(input as any);
      expect(result.difficulty).toBe('Medium');
    });
  });

  describe('normalizeType function', () => {
    it('should normalize "behavioral" to Behavioral', () => {
      const input = { 
        status: 'CREATED' as const,
        interviewType: 'behavioral',
        interviewMetaData: {}
      };
      const result = normalizeInterview(input as any);
      expect(result.type).toBe('Behavioral');
    });

    it('should normalize "technical" to Technical', () => {
      const input = { 
        status: 'CREATED' as const,
        interviewType: 'technical',
        interviewMetaData: {}
      };
      const result = normalizeInterview(input as any);
      expect(result.type).toBe('Technical');
    });

    it('should normalize "coding" to Coding', () => {
      const input = { 
        status: 'CREATED' as const,
        interviewType: 'coding',
        interviewMetaData: {}
      };
      const result = normalizeInterview(input as any);
      expect(result.type).toBe('Coding');
    });

    it('should default to Mixed', () => {
      const input = { 
        status: 'CREATED' as const,
        interviewMetaData: {}
      };
      const result = normalizeInterview(input as any);
      expect(result.type).toBe('Mixed');
    });
  });

  describe('normalizeStyle function', () => {
    it('should normalize valid styles', () => {
      const validStyles = ['FAANG', 'MAANG', 'STARTUP', 'REGULAR'];
      
      for (const style of validStyles) {
        const input = { 
          status: 'CREATED' as const,
          interviewCompanyStyle: style,
          interviewMetaData: {}
        };
        const result = normalizeInterview(input as any);
        expect(result.interviewStyle).toBe(style);
      }
    });

    it('should default to REGULAR for invalid style', () => {
      const input = { 
        status: 'CREATED' as const,
        interviewCompanyStyle: 'INVALID_STYLE',
        interviewMetaData: {}
      };
      const result = normalizeInterview(input as any);
      expect(result.interviewStyle).toBe('REGULAR');
    });
  });

  describe('Full normalization', () => {
    it('should normalize a complete interview object', () => {
      const input = {
        id: 'int-123',
        userId: 'user-456',
        status: 'INPROGRESS',
        interviewDifficulty: 'medium',
        interviewType: 'technical',
        interviewCompanyStyle: 'FAANG',
        interviewMetaData: {
          jobRole: 'Frontend Developer',
          domain: 'Web Development',
          experience: 'mid-level',
          jobSkills: ['React', 'TypeScript'],
          targetedCompany: 'Google',
          endingCriteria: 'DURATION' as const
        },
        interviewDuration: 60,
        createdAt: '2023-01-01T00:00:00Z',
        lastActivityAt: '2023-01-01T01:00:00Z',
        progress: 50,
        score: 85,
        currentRound: 2,
        currentQuestion: 3
      };

      const result = normalizeInterview(input as any);

      // Check the key fields
      expect(result.id).toBe('int-123');
      expect(result.userId).toBe('user-456');
      expect(result.status).toBe('IN_PROGRESS'); // INPROGRESS -> IN_PROGRESS
      expect(result.difficulty).toBe('Medium'); // medium -> Medium
      expect(result.type).toBe('Technical'); // technical -> Technical
      expect(result.interviewStyle).toBe('FAANG'); // FAANG stays FAANG
      expect(result.roleTitle).toBe('Frontend Developer'); // from jobRole
      expect(result.domain).toBe('Web Development'); // from domain
      expect(result.company).toBe('Google'); // from targetedCompany
      expect(result.experienceLevel).toBe('Mid-level'); // mid-level -> Mid-level
      expect(result.topics).toEqual(['React', 'TypeScript']); // from jobSkills
      expect(result.targetedCompany).toBe('Google'); // from targetedCompany
      expect(result.endingCriteria).toBe('DURATION'); // from endingCriteria
      expect(result.durationMin).toBe(60); // from interviewDuration
      expect(result.createdAt).toBe('2023-01-01T00:00:00Z');
      expect(result.lastActivityAt).toBe('2023-01-01T01:00:00Z'); // from lastActivityAt
      expect(result.progress).toBe(50);
      expect(result.score).toBe(85);
      expect(result.currentRound).toBe(2);
      expect(result.currentQuestion).toBe(3);
    });

    it('should handle adaptive difficulty override', () => {
      const input = {
        id: 'int-123',
        status: 'CREATED',
        interviewMetaData: {
          isAdaptive: true
        }
      };

      const result = normalizeInterview(input as any);
      expect(result.difficulty).toBe('Adaptive'); // Should be Adaptive despite other settings
    });

    it('should handle various experience levels', () => {
      const testCases = [
        { backend: 'senior', expected: 'Senior' },
        { backend: 'mid-level', expected: 'Mid-level' },
        { backend: 'junior', expected: 'Junior' },
        { backend: 'fresher', expected: 'Entry' },
        { backend: 'invalid', expected: 'Entry' },
      ];

      for (const testCase of testCases) {
        const input = {
          id: 'int-123',
          status: 'CREATED',
          interviewMetaData: {
            experience: testCase.backend
          }
        };

        const result = normalizeInterview(input as any);
        expect(result.experienceLevel).toBe(testCase.expected);
      }
    });

    it('should handle targetedCompanyOther', () => {
      const input = {
        id: 'int-123',
        status: 'CREATED',
        interviewMetaData: {
          targetedCompanyOther: 'My Startup'
        }
      };

      const result = normalizeInterview(input as any);
      expect(result.company).toBe('My Startup');
      expect(result.targetedCompanyOther).toBe('My Startup');
    });
  });
});