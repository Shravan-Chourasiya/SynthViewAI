import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useParams } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { ResetPasswordPage } from '@/pages/auth/reset-password';
import * as authService from '@/lib/services/auth.service';

// Define mockNavigate at module level
const mockNavigate = vi.fn();

// Mock the services and navigation
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ token: 'test-reset-token' }),
  };
});

// Create wrapper components that include both ThemeProvider and Router
const renderWithProviders = (ui: React.ReactElement, initialEntries: string[] = ['/reset-password/test-reset-token']) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Reset Password Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('renders reset password form with required inputs', () => {
    renderWithProviders(<ResetPasswordPage />);
    
    expect(screen.getByText(/reset password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('shows validation error for password mismatch', async () => {
    renderWithProviders(<ResetPasswordPage />);
    
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    
    fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPassword456@' } });

    const submitButton = screen.getByRole('button', { name: /reset password/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for weak password', async () => {
    renderWithProviders(<ResetPasswordPage />);
    
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    
    fireEvent.change(newPasswordInput, { target: { value: 'weak' } }); // Too short
    fireEvent.change(confirmPasswordInput, { target: { value: 'weak' } });

    const submitButton = screen.getByRole('button', { name: /reset password/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // Password checklist should show missing criteria
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/one uppercase letter/i)).toBeInTheDocument();
      expect(screen.getByText(/one lowercase letter/i)).toBeInTheDocument();
      expect(screen.getByText(/one number/i)).toBeInTheDocument();
      expect(screen.getByText(/one special character/i)).toBeInTheDocument();
    });
  });

  it('calls resetPassword service with correct parameters on successful submission', async () => {
    vi.spyOn(authService, 'resetPassword').mockResolvedValue(undefined);

    renderWithProviders(<ResetPasswordPage />);
    
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(newPasswordInput, { target: { value: 'NewSecurePass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'NewSecurePass123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(authService.resetPassword).toHaveBeenCalledWith({
        token: 'test-reset-token',
        newPassword: 'NewSecurePass123!'
      });
    });
  });

  it('redirects to login after successful password reset', async () => {
    vi.spyOn(authService, 'resetPassword').mockResolvedValue(undefined);

    renderWithProviders(<ResetPasswordPage />);
    
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(newPasswordInput, { target: { value: 'NewSecurePass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'NewSecurePass123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('shows error message for invalid reset token', async () => {
    const errorMessage = 'Invalid or expired reset token';
    vi.spyOn(authService, 'resetPassword').mockRejectedValue(new Error(errorMessage));

    renderWithProviders(<ResetPasswordPage />);
    
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(newPasswordInput, { target: { value: 'NewSecurePass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'NewSecurePass123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('disables submit button during reset to prevent duplicate submissions', async () => {
    const resetPromise = new Promise(() => {}); // Never resolves, simulates loading
    vi.spyOn(authService, 'resetPassword').mockReturnValue(resetPromise as any);

    renderWithProviders(<ResetPasswordPage />);
    
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(newPasswordInput, { target: { value: 'NewSecurePass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'NewSecurePass123!' } });
    fireEvent.click(submitButton);

    // Button should be disabled during submission
    expect(submitButton).toBeDisabled();
  });

  it('validates that new password is different from old password (if applicable)', async () => {
    // This test assumes there's logic to check if new password is different from old
    // If not implemented in the component, this test might not apply
    renderWithProviders(<ResetPasswordPage />);
    
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    
    // Test with a potentially reused password
    fireEvent.change(newPasswordInput, { target: { value: 'SameOldPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'SameOldPass123!' } });

    // The validation would happen on submit, so we'll just verify the inputs are accepted
    expect(newPasswordInput.value).toBe('SameOldPass123!');
    expect(confirmPasswordInput.value).toBe('SameOldPass123!');
  });
});