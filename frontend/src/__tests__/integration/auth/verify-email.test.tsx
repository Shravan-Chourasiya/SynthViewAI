import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { VerifyEmailPage } from '@/pages/auth/verify-email';
import * as authService from '@/lib/services/auth.service';
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

// Create wrapper components that include both ThemeProvider and Router
const renderWithProviders = (ui: React.ReactElement, initialEntries: string[] = ['/verify-email']) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Verify Email Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Reset auth store state
    useAuthStore.setState({
      user: null,
      pendingEmail: 'test@example.com',
      status: "idle",
      error: null,
    });
  });

  it('renders verify email form with OTP input', () => {
    renderWithProviders(<VerifyEmailPage />);
    
    expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
    expect(screen.getByText(/we sent a verification code to test@example.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter 6-digit code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify email/i })).toBeInTheDocument();
  });

  it('shows validation error for incomplete OTP', async () => {
    renderWithProviders(<VerifyEmailPage />);
    
    const otpInput = screen.getByPlaceholderText('Enter 6-digit code');
    fireEvent.change(otpInput, { target: { value: '123' } }); // Only 3 digits

    const verifyButton = screen.getByRole('button', { name: /verify email/i });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter the full 6-digit code/i)).toBeInTheDocument();
    });
  });

  it('calls verify service with correct parameters on OTP submission', async () => {
    vi.spyOn(authService, 'verifyEmail').mockResolvedValue(undefined);

    renderWithProviders(<VerifyEmailPage />);
    
    const otpInput = screen.getByPlaceholderText('Enter 6-digit code');
    const verifyButton = screen.getByRole('button', { name: /verify email/i });

    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(authService.verifyEmail).toHaveBeenCalledWith({
        email: 'test@example.com',
        otp: '123456'
      });
    });
  });

  it('redirects to login after successful OTP verification', async () => {
    vi.spyOn(authService, 'verifyEmail').mockResolvedValue(undefined);

    renderWithProviders(<VerifyEmailPage />);
    
    const otpInput = screen.getByPlaceholderText('Enter 6-digit code');
    const verifyButton = screen.getByRole('button', { name: /verify email/i });

    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('shows error message for invalid/expired OTP', async () => {
    const errorMessage = 'Invalid or expired verification code';
    vi.spyOn(authService, 'verifyEmail').mockRejectedValue(new Error(errorMessage));

    renderWithProviders(<VerifyEmailPage />);
    
    const otpInput = screen.getByPlaceholderText('Enter 6-digit code');
    const verifyButton = screen.getByRole('button', { name: /verify email/i });

    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('handles resend OTP functionality', async () => {
    vi.spyOn(authService, 'resendVerification').mockResolvedValue(undefined);

    renderWithProviders(<VerifyEmailPage />);
    
    const resendButton = screen.getByRole('button', { name: /resend code/i });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(authService.resendVerification).toHaveBeenCalledWith('test@example.com');
    });

    expect(screen.getByText(/verification code resent!/i)).toBeInTheDocument();
  });

  it('disables verify button during verification to prevent duplicate submissions', async () => {
    const verificationPromise = new Promise(() => {}); // Never resolves, simulates loading
    vi.spyOn(authService, 'verifyEmail').mockReturnValue(verificationPromise as any);

    renderWithProviders(<VerifyEmailPage />);
    
    const otpInput = screen.getByPlaceholderText('Enter 6-digit code');
    const verifyButton = screen.getByRole('button', { name: /verify email/i });

    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(verifyButton);

    // Button should be disabled during verification
    expect(verifyButton).toBeDisabled();
  });
});