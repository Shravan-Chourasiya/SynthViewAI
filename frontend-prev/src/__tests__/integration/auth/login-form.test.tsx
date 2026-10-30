import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { LoginForm } from '@/components/auth/login-form';
import { useAuthStore } from '@/lib/stores/auth.store';

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

// Mock the auth store
vi.mock('@/lib/stores/auth.store', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useAuthStore: vi.fn(),
  };
});

// Create wrapper components that include both ThemeProvider and Router
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Login Form Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Mock the auth store with login function
    vi.mocked(useAuthStore).mockReturnValue({
      login: vi.fn(),
      status: 'unauthenticated',
      user: null,
      pendingEmail: null,
      error: null,
      logout: vi.fn(),
      bootstrap: vi.fn(),
    });
  });

  it('renders login form with email and password fields', () => {
    renderWithProviders(<LoginForm onSuccess={mockNavigate} />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    renderWithProviders(<LoginForm onSuccess={mockNavigate} />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email is required\./i)).toBeInTheDocument();
      expect(screen.getByText(/password is required\./i)).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email format', async () => {
    renderWithProviders(<LoginForm onSuccess={mockNavigate} />);
    
    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email format\./i)).toBeInTheDocument();
    });
  });

  it('calls login store action with correct credentials on successful submission', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuthStore).mockReturnValue({
      login: mockLogin,
      status: 'unauthenticated',
      user: null,
      pendingEmail: null,
      error: null,
      logout: vi.fn(),
      bootstrap: vi.fn(),
    });

    renderWithProviders(<LoginForm onSuccess={mockNavigate} />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('handles login errors gracefully', async () => {
    const errorMessage = 'Invalid credentials';
    const mockLogin = vi.fn().mockRejectedValue(new Error(errorMessage));
    vi.mocked(useAuthStore).mockReturnValue({
      login: mockLogin,
      status: 'unauthenticated',
      user: null,
      pendingEmail: null,
      error: null,
      logout: vi.fn(),
      bootstrap: vi.fn(),
    });

    renderWithProviders(<LoginForm onSuccess={mockNavigate} />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('redirects after successful login', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuthStore).mockReturnValue({
      login: mockLogin,
      status: 'unauthenticated',
      user: null,
      pendingEmail: null,
      error: null,
      logout: vi.fn(),
      bootstrap: vi.fn(),
    });

    renderWithProviders(<LoginForm onSuccess={mockNavigate} />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    // Wait for the success state and navigation
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith();
    });
  });

  it('disables submit button during login to prevent duplicate submissions', async () => {
    const loginPromise = new Promise(() => {}); // Never resolves, simulates loading
    const mockLogin = vi.fn().mockReturnValue(loginPromise as any);
    vi.mocked(useAuthStore).mockReturnValue({
      login: mockLogin,
      status: 'unauthenticated',
      user: null,
      pendingEmail: null,
      error: null,
      logout: vi.fn(),
      bootstrap: vi.fn(),
    });

    renderWithProviders(<LoginForm onSuccess={mockNavigate} />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    // Button should be disabled during submission
    expect(submitButton).toBeDisabled();
  });
});