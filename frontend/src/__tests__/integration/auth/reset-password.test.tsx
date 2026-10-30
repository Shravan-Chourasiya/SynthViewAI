import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import ResetPasswordPage from '@/pages/auth/reset-password';
import { authService } from '@/lib/services/auth';
import { toast } from 'sonner';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const renderWithProviders = (
  ui: React.ReactElement,
  initialEntries: string[] = ['/reset-password?email=test%40example.com&otp=123456'],
) =>
  render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </ThemeProvider>
  );

describe('Reset Password Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('renders reset password form with required inputs', () => {
    renderWithProviders(<ResetPasswordPage />);

    expect(screen.getByText(/choose a new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
  });

  it('shows validation error for password mismatch', () => {
    renderWithProviders(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'NewPassword123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'DifferentPassword456@' },
    });

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled();
  });

  it('keeps a short password from submitting', () => {
    renderWithProviders(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'weak' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'weak' } });

    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled();
  });

  it('calls resetPassword service with correct parameters on successful submission', async () => {
    vi.spyOn(authService, 'forgotPasswordVerify').mockResolvedValue(undefined);

    renderWithProviders(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'NewPassword123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'NewPassword123!' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(authService.forgotPasswordVerify).toHaveBeenCalledWith({
        email: 'test@example.com',
        otp: '123456',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      });
    });
  });

  it('redirects to login after successful password reset', async () => {
    vi.spyOn(authService, 'forgotPasswordVerify').mockResolvedValue(undefined);

    renderWithProviders(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'NewPassword123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'NewPassword123!' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('surfaces a rejected reset as a toast and does not navigate', async () => {
    vi.spyOn(authService, 'forgotPasswordVerify').mockRejectedValue(new Error('Invalid or expired code'));

    renderWithProviders(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'NewPassword123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'NewPassword123!' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Reset failed', {
        description: 'Invalid or expired code',
      });
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
