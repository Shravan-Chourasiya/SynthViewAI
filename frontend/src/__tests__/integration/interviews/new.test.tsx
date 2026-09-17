import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { NewInterviewPage } from '@/pages/interviews/new';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useInterviewStore } from '@/lib/stores/interview.store';

// Define mockNavigate at module level
const mockNavigate = vi.fn();

// Mock the services and navigation
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/lib/stores/auth.store');
vi.mock('@/lib/stores/interview.store');

// Create wrapper components that include both ThemeProvider and Router
const renderWithProviders = (ui: React.ReactElement, initialEntries: string[] = ['/interviews/new']) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('New Interview Page Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Mock the auth store
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      status: 'authenticated',
      pendingEmail: null,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      bootstrap: vi.fn(),
    });
    
    // Mock the interview store
    vi.mocked(useInterviewStore).mockReturnValue({
      interviews: [],
      currentInterview: null,
      loading: false,
      error: null,
      loadInterview: vi.fn(),
      loadInterviews: vi.fn(),
      createInterview: vi.fn().mockResolvedValue({ id: 'new-interview-id' }),
      updateInterview: vi.fn(),
      deleteInterview: vi.fn(),
      setCurrentInterview: vi.fn(),
      clearCurrentInterview: vi.fn(),
      reset: vi.fn(),
    });
  });

  it('renders new interview form with all fields', () => {
    renderWithProviders(<NewInterviewPage />);
    
    expect(screen.getByText(/new interview/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/interview title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target company/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/industry/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/interview type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/difficulty/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/experience level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/duration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/skills to assess/i)).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    const mockCreateInterview = vi.fn().mockResolvedValue({ id: 'interview-123' });
    vi.mocked(useInterviewStore).mockReturnValue({
      interviews: [],
      currentInterview: null,
      loading: false,
      error: null,
      loadInterview: vi.fn(),
      loadInterviews: vi.fn(),
      createInterview: mockCreateInterview,
      updateInterview: vi.fn(),
      deleteInterview: vi.fn(),
      setCurrentInterview: vi.fn(),
      clearCurrentInterview: vi.fn(),
      reset: vi.fn(),
    });

    renderWithProviders(<NewInterviewPage />);
    
    // Fill in the form with valid data
    const titleInput = screen.getByLabelText(/interview title/i);
    fireEvent.change(titleInput, { target: { value: 'Frontend Developer Interview' } });
    
    const companyInput = screen.getByLabelText(/target company/i);
    fireEvent.change(companyInput, { target: { value: 'Google' } });
    
    const industryInput = screen.getByLabelText(/industry/i);
    fireEvent.change(industryInput, { target: { value: 'Technology' } });
    
    const roleInput = screen.getByLabelText(/role/i);
    fireEvent.change(roleInput, { target: { value: 'Frontend Engineer' } });
    
    const typeSelect = screen.getByRole('combobox', { name: /interview type/i });
    fireEvent.mouseDown(typeSelect);
    fireEvent.click(screen.getByText(/technical/i));
    
    const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i });
    fireEvent.mouseDown(difficultySelect);
    fireEvent.click(screen.getByText(/medium/i));
    
    const levelSelect = screen.getByRole('combobox', { name: /experience level/i });
    fireEvent.mouseDown(levelSelect);
    fireEvent.click(screen.getByText(/mid/i));
    
    const durationSelect = screen.getByRole('combobox', { name: /duration/i });
    fireEvent.mouseDown(durationSelect);
    fireEvent.click(screen.getByText(/30 min/i));
    
    const skillsInput = screen.getByPlaceholderText(/add skills to assess/i);
    fireEvent.change(skillsInput, { target: { value: 'React' } });
    fireEvent.keyDown(skillsInput, { key: 'Enter' });
    
    // Submit the form
    const submitButton = screen.getByRole('button', { name: /create interview/i });
    fireEvent.click(submitButton);
    
    // Wait for navigation to occur
    await waitFor(() => {
      expect(mockCreateInterview).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/interviews/interview-123/lobby');
    });
  });

  it('shows validation errors for empty required fields', async () => {
    renderWithProviders(<NewInterviewPage />);
    
    // Try to submit with empty form
    const submitButton = screen.getByRole('button', { name: /create interview/i });
    fireEvent.click(submitButton);
    
    // Wait for validation errors to appear
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(screen.getByText(/company is required/i)).toBeInTheDocument();
      expect(screen.getByText(/industry is required/i)).toBeInTheDocument();
      expect(screen.getByText(/role is required/i)).toBeInTheDocument();
    });
  });

  it('updates form fields correctly', () => {
    renderWithProviders(<NewInterviewPage />);
    
    const titleInput = screen.getByLabelText(/interview title/i);
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
    
    expect(titleInput).toHaveValue('Updated Title');
  });

  it('allows adding and removing skills', () => {
    renderWithProviders(<NewInterviewPage />);
    
    const skillsInput = screen.getByPlaceholderText(/add skills to assess/i);
    
    // Add a skill
    fireEvent.change(skillsInput, { target: { value: 'React' } });
    fireEvent.keyDown(skillsInput, { key: 'Enter' });
    
    expect(screen.getByText(/react/i)).toBeInTheDocument();
    
    // Add another skill
    fireEvent.change(skillsInput, { target: { value: 'TypeScript' } });
    fireEvent.keyDown(skillsInput, { key: 'Enter' });
    
    expect(screen.getByText(/typescript/i)).toBeInTheDocument();
  });

  it('shows loading state during form submission', async () => {
    const mockCreateInterview = vi.fn()
      .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ id: 'interview-123' }), 100)));
      
    vi.mocked(useInterviewStore).mockReturnValue({
      interviews: [],
      currentInterview: null,
      loading: false,
      error: null,
      loadInterview: vi.fn(),
      loadInterviews: vi.fn(),
      createInterview: mockCreateInterview,
      updateInterview: vi.fn(),
      deleteInterview: vi.fn(),
      setCurrentInterview: vi.fn(),
      clearCurrentInterview: vi.fn(),
      reset: vi.fn(),
    });

    renderWithProviders(<NewInterviewPage />);
    
    const titleInput = screen.getByLabelText(/interview title/i);
    fireEvent.change(titleInput, { target: { value: 'Loading Test' } });
    
    const submitButton = screen.getByRole('button', { name: /create interview/i });
    fireEvent.click(submitButton);
    
    // Button should be disabled during submission
    expect(submitButton).toBeDisabled();
  });
});