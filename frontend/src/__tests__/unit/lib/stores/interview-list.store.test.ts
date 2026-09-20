import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInterviewListStore } from '@/lib/stores/interview-list.store';
import * as interviewService from '@/lib/services/interview.service';
import { normalizeInterview } from '@/lib/normalizers/interview';

// Mock the interview service and normalizer
vi.mock('@/lib/services/interview.service');
vi.mock('@/lib/normalizers/interview');

describe('interview-list.store', () => {
  beforeEach(() => {
    // Reset the store before each test by setting initial state
    useInterviewListStore.setState({
      interviews: [],
      status: "idle",
      error: null,
      fetchedAt: null,
    });
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with correct default values', () => {
      const state = useInterviewListStore.getState();
      
      expect(state.interviews).toEqual([]);
      expect(state.status).toBe('idle');
      expect(state.error).toBeNull();
      expect(state.fetchedAt).toBeNull();
    });
  });

  describe('fetchInterviews', () => {
    it('should fetch interviews and update state', async () => {
      const mockInterviews = [
        { id: '1', title: 'Interview 1', status: 'SCHEDULED' },
        { id: '2', title: 'Interview 2', status: 'COMPLETED' }
      ];
      const normalizedInterviews = [
        { id: '1', title: 'Interview 1', status: 'SCHEDULED', normalized: true },
        { id: '2', title: 'Interview 2', status: 'COMPLETED', normalized: true }
      ];

      vi.spyOn(interviewService, 'listInterviews').mockResolvedValue(mockInterviews);
      vi.mocked(normalizeInterview).mockImplementation((interview) => ({ 
        ...interview, 
        normalized: true 
      }));

      const { fetchInterviews } = useInterviewListStore.getState();
      const result = await fetchInterviews();

      const state = useInterviewListStore.getState();
      expect(result).toEqual(normalizedInterviews);
      expect(state.interviews).toEqual(normalizedInterviews);
      expect(state.status).toBe('ready');
      expect(state.error).toBeNull();
      expect(state.fetchedAt).not.toBeNull();
    });

    it('should return cached data when not expired and not forced', async () => {
      // Pre-populate the store with data
      const mockInterviews = [{ id: '1', title: 'Cached Interview', status: 'SCHEDULED' }];
      useInterviewListStore.setState({
        interviews: mockInterviews,
        status: 'ready',
        fetchedAt: Date.now() - 10000, // Less than 30 seconds ago
      });

      vi.spyOn(interviewService, 'listInterviews').mockResolvedValue([]);

      const { fetchInterviews } = useInterviewListStore.getState();
      const result = await fetchInterviews();

      expect(result).toEqual(mockInterviews);
      expect(interviewService.listInterviews).not.toHaveBeenCalled();
    });

    it('should fetch fresh data when force option is true', async () => {
      // Pre-populate the store with data
      const mockInterviews = [{ id: '1', title: 'Old Interview', status: 'SCHEDULED' }];
      const newMockInterviews = [{ id: '2', title: 'New Interview', status: 'SCHEDULED' }];
      useInterviewListStore.setState({
        interviews: mockInterviews,
        status: 'ready',
        fetchedAt: Date.now() - 10000, // Less than 30 seconds ago
      });

      vi.spyOn(interviewService, 'listInterviews').mockResolvedValue(newMockInterviews);
      vi.mocked(normalizeInterview).mockImplementation((interview) => interview);

      const { fetchInterviews } = useInterviewListStore.getState();
      const result = await fetchInterviews({ force: true });

      expect(result).toEqual(newMockInterviews);
      expect(interviewService.listInterviews).toHaveBeenCalled();
    });

    it('records a failed fetch instead of staying in the loading state', async () => {
      const errorMessage = 'Failed to fetch interviews';
      vi.spyOn(interviewService, 'listInterviews').mockRejectedValue(new Error(errorMessage));

      const { fetchInterviews } = useInterviewListStore.getState();
      await expect(fetchInterviews()).rejects.toThrow(errorMessage);

      // The rejection still reaches the caller, but the store must also leave the
      // loading state — otherwise the history page renders its skeleton forever
      // instead of the "Unable to load interview history" message.
      const state = useInterviewListStore.getState();
      expect(state.status).toBe('error');
      expect(state.error).toBe(errorMessage);
      expect(state.fetchedAt).toBeNull();
    });

    it('does not let a hanging request block later fetches', async () => {
      // A request that never settles (stalled connection) must not pin `inFlight`.
      vi.spyOn(interviewService, 'listInterviews').mockReturnValue(new Promise(() => {}) as never);
      const { fetchInterviews } = useInterviewListStore.getState();
      void fetchInterviews().catch(() => undefined);

      // reset() invalidates the in-flight request so the next fetch really runs.
      useInterviewListStore.getState().reset();

      const recovered = [{ id: '1', title: 'Recovered', status: 'SCHEDULED' }];
      vi.mocked(interviewService.listInterviews).mockResolvedValue(recovered as never);
      vi.mocked(normalizeInterview).mockImplementation((interview) => interview as never);

      const result = await fetchInterviews();
      expect(result).toEqual(recovered);
      expect(useInterviewListStore.getState().status).toBe('ready');
    });
  });

  describe('createInterview', () => {
    it('should create an interview and refetch the list', async () => {
      const mockConfig = { title: 'New Interview', type: 'TECHNICAL' };
      const mockResponse = { id: 'new-id', title: 'New Interview', status: 'CREATED' };
      const mockInterviewsAfterCreate = [
        { id: 'existing', title: 'Existing Interview', status: 'SCHEDULED' },
        { id: 'new-id', title: 'New Interview', status: 'CREATED' }
      ];

      vi.spyOn(interviewService, 'createInterview').mockResolvedValue(mockResponse);
      vi.spyOn(interviewService, 'listInterviews').mockResolvedValue(mockInterviewsAfterCreate);
      vi.mocked(normalizeInterview).mockImplementation((interview) => interview);

      const { createInterview } = useInterviewListStore.getState();
      const result = await createInterview(mockConfig);

      expect(result).toBe('new-id');
      expect(interviewService.createInterview).toHaveBeenCalledWith(mockConfig);
      expect(interviewService.listInterviews).toHaveBeenCalled(); // Refetch after creation
    });
  });

  describe('cancelInterview', () => {
    it('should optimistically update status and then refetch', async () => {
      const initialInterviews = [
        { id: '1', title: 'Interview 1', status: 'SCHEDULED' },
        { id: '2', title: 'Interview 2', status: 'SCHEDULED' }
      ];
      const updatedInterviews = [
        { id: '1', title: 'Interview 1', status: 'CANCELLED' }, // Updated status
        { id: '2', title: 'Interview 2', status: 'SCHEDULED' }
      ];
      const finalInterviews = [
        { id: '1', title: 'Interview 1', status: 'CANCELLED' },
        { id: '2', title: 'Interview 2', status: 'SCHEDULED' },
        { id: '3', title: 'Interview 3', status: 'COMPLETED' }
      ];

      useInterviewListStore.setState({
        interviews: initialInterviews,
        status: 'ready',
        fetchedAt: Date.now()
      });

      vi.spyOn(interviewService, 'cancelInterview').mockResolvedValue(undefined);
      vi.spyOn(interviewService, 'listInterviews').mockResolvedValue(finalInterviews);
      vi.mocked(normalizeInterview).mockImplementation((interview) => interview);

      const { cancelInterview } = useInterviewListStore.getState();
      await cancelInterview('1');

      const state = useInterviewListStore.getState();
      expect(interviewService.cancelInterview).toHaveBeenCalledWith('1');
      expect(interviewService.listInterviews).toHaveBeenCalled(); // Refetch after cancellation
      expect(state.interviews).toEqual(finalInterviews);
    });

    it('should revert optimistic update on error', async () => {
      const initialInterviews = [
        { id: '1', title: 'Interview 1', status: 'SCHEDULED' },
        { id: '2', title: 'Interview 2', status: 'SCHEDULED' }
      ];

      useInterviewListStore.setState({
        interviews: initialInterviews,
        status: 'ready',
        fetchedAt: Date.now()
      });

      const error = new Error('Cancellation failed');
      vi.spyOn(interviewService, 'cancelInterview').mockRejectedValue(error);
      vi.spyOn(interviewService, 'listInterviews').mockResolvedValue([]);

      const { cancelInterview } = useInterviewListStore.getState();
      await expect(cancelInterview('1')).rejects.toThrow('Cancellation failed');

      const state = useInterviewListStore.getState();
      // Should revert to initial state after error
      expect(state.interviews).toEqual(initialInterviews);
    });
  });

  describe('reset', () => {
    it('should reset the store to initial state', () => {
      // Set some state to reset
      useInterviewListStore.setState({
        interviews: [{ id: '1', title: 'Test Interview', status: 'SCHEDULED' }],
        status: 'ready',
        error: 'Some error',
        fetchedAt: Date.now()
      });

      const { reset } = useInterviewListStore.getState();
      reset();

      const state = useInterviewListStore.getState();
      expect(state.interviews).toEqual([]);
      expect(state.status).toBe('idle');
      expect(state.error).toBeNull();
      expect(state.fetchedAt).toBeNull();
    });
  });
});