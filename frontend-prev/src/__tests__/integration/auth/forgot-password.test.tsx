import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password';
import * as authService from '@/lib/services/auth.service';

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

// Create wrapper components that include both ThemeProvider and Router
const renderWithProviders = (ui: React.ReactElement, initialEntries: string[] = ['/forgot-password']) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Forgot Password Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('renders forgot password form with email input', () => {
    renderWithProviders(<ForgotPasswordPage />);
    
    expect(screen.getByText(/forgot password\?/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('shows validation error for invalid email format', async () => {
    renderWithProviders(<ForgotPasswordPage />);
    
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });
  });

  it('calls forgotPassword service with correct email on submission', async () => {
    vi.spyOn(authService, 'forgotPassword').mockResolvedValue(undefined);

    renderWithProviders(<ForgotPasswordPage />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(authService.forgotPassword).toHaveBeenCalledWith('test@example.com');
    });
  });

  it('shows success message after submitting email regardless of existence', async () => {
    vi.spyOn(authService, 'forgotPassword').mockResolvedValue(undefined);

    renderWithProviders(<ForgotPasswordPage />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/if an account exists with that email, you will receive a password reset link/i)).toBeInTheDocument();
    });
  });

  it('shows generic error message for service failures', async () => {
    const errorMessage = 'Something went wrong';
    vi.spyOn(authService, 'forgotPassword').mockRejectedValue(new Error(errorMessage));

    renderWithProviders(<ForgotPasswordPage />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // Should show a generic message to avoid revealing if email exists
      expect(screen.getByText(/something went wrong\. please try again\./i)).toBeInTheDocument();
    });
  });

  it('disables submit button during submission to prevent duplicate requests', async () => {
    const forgotPasswordPromise = new Promise(() => {}); // Never resolves, simulates loading
    vi.spyOn(authService, 'forgotPassword').mockReturnValue(forgotPasswordPromise as any);

    renderWithProviders(<ForgotPasswordPage />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    // Button should be disabled during submission
    expect(submitButton).toBeDisabled();
  });

  it('allows user to go back to login after submitting email', async () => {
    vi.spyOn(authService, 'forgotPassword').mockResolvedValue(undefined);

    renderWithProviders(<ForgotPasswordPage />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/if an account exists with that email, you will receive a password reset link/i)).toBeInTheDocument();
    });

    // Test navigating back to login
    const backButton = screen.getByRole('link', { name: /back to login/i });
    fireEvent.click(backButton);

    // Since we're using MemoryRouter with initial entries, we can't truly navigate back
    // But we can check that the link exists and has the correct destination
    expect(backButton).toHaveAttribute('href', '/login');
  });
});