import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { NewInterviewPage } from '@/pages/interviews/new';
import { useInterviewListStore } from '@/lib/stores/interview-list.store';

// Define mockNavigate at module level
const mockNavigate = vi.fn();

// Mock react-router-dom to provide the mock navigate function
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Create a wrapper component that includes both ThemeProvider and Router
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

// Create a wrapper component that includes both ThemeProvider and Router
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('New Interview Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('renders interview configuration form', () => {
    renderWithProviders(<NewInterviewPage />);
    
    expect(screen.getByText(/configure your interview/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /experience/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /target role/i })).toBeInTheDocument();
    expect(screen.getByText(/duration/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create & enter lobby/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    renderWithProviders(<NewInterviewPage />);
    
    // Go to the first step and click continue
    const continueButton = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(continueButton);
    
    await waitFor(() => {
      expect(screen.getByText(/field \/ domain is required/i)).toBeInTheDocument();
      expect(screen.getByText(/target role is required/i)).toBeInTheDocument();
    });
  });

  it('calls create interview with correct configuration', async () => {
    renderWithProviders(<NewInterviewPage />);
    
    // Fill in the first step
    const domainInput = screen.getByRole('textbox', { name: /field \/ domain/i });
    fireEvent.change(domainInput, { target: { value: 'Software Engineering' } });
    
    const roleInput = screen.getByRole('textbox', { name: /target role/i });
    fireEvent.change(roleInput, { target: { value: 'Software Engineer' } });
    
    // Click continue to go to the next step
    const continueButton = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(continueButton);
    
    // Continue through the wizard steps to the end
    for (let i = 0; i < 5; i++) { // Skip through the remaining steps
      fireEvent.click(continueButton);
    }
    
    // Click the create button
    const createButton = screen.getByRole('button', { name: /create & enter lobby/i });
    fireEvent.click(createButton);
    
    await waitFor(() => {
      // Verify the mock store's createInterview was called
      expect(useInterviewListStore.getState().createInterview).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/interviews/interview-123/lobby');
    });
  });

  it('handles interview creation errors', async () => {
    // Re-mock the store to return a rejected promise for createInterview
    vi.mocked(useInterviewListStore).mockImplementation((selector) => {
      const mockStoreWithError = {
        interviews: [],
        status: "idle",
        error: null,
        fetchedAt: null,
        fetchInterviews: vi.fn().mockResolvedValue([]),
        createInterview: vi.fn().mockRejectedValue(new Error('Failed to create interview')),
        cancelInterview: vi.fn(),
        reset: vi.fn(),
      };
      
      if (typeof selector === 'function') {
        return selector(mockStoreWithError);
      }
      return mockStoreWithError;
    });

    renderWithProviders(<NewInterviewPage />);
    
    // Fill in minimal required fields for the first step
    const domainInput = screen.getByRole('textbox', { name: /field \/ domain/i });
    fireEvent.change(domainInput, { target: { value: 'Software Engineering' } });
    
    const roleInput = screen.getByRole('textbox', { name: /target role/i });
    fireEvent.change(roleInput, { target: { value: 'Software Engineer' } });
    
    // Navigate through all steps
    const continueButton = screen.getByRole('button', { name: /continue/i });
    for (let i = 0; i < 6; i++) { // Skip through all steps
      fireEvent.click(continueButton);
    }
    
    // Click the create button
    const createButton = screen.getByRole('button', { name: /create & enter lobby/i });
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to create interview')).toBeInTheDocument();
    });
  });

  it('redirects to lobby after successful creation', async () => {
    renderWithProviders(<NewInterviewPage />);
    
    // Fill in minimal required fields for the first step
    const domainInput = screen.getByRole('textbox', { name: /field \/ domain/i });
    fireEvent.change(domainInput, { target: { value: 'Software Engineering' } });
    
    const roleInput = screen.getByRole('textbox', { name: /target role/i });
    fireEvent.change(roleInput, { target: { value: 'Software Engineer' } });
    
    // Navigate through all steps
    const continueButton = screen.getByRole('button', { name: /continue/i });
    for (let i = 0; i < 6; i++) { // Skip through all steps
      fireEvent.click(continueButton);
    }
    
    // Click the create button
    const createButton = screen.getByRole('button', { name: /create & enter lobby/i });
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/interviews/interview-123/lobby');
    });
  });
});