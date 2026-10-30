import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import ForgotPasswordPage from '@/pages/auth/forgot-password';
import { authService } from '@/lib/services/auth';

vi.mock('@/lib/services/auth');

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );

describe('Forgot Password Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders forgot password form with email input', () => {
    renderWithProviders(<ForgotPasswordPage />);

    expect(screen.getByText(/we'll email you a link/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('calls forgotPassword service with the entered email on submission', async () => {
    vi.spyOn(authService, 'forgotPassword').mockResolvedValue(undefined);

    renderWithProviders(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(authService.forgotPassword).toHaveBeenCalledWith({ email: 'test@example.com' });
    });
  });

  it('shows the sent confirmation after a successful request', async () => {
    vi.spyOn(authService, 'forgotPassword').mockResolvedValue(undefined);

    renderWithProviders(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/the link is on its way/i)).toBeInTheDocument();
    });
    // The form is replaced by the confirmation, so it cannot be resubmitted.
    expect(screen.queryByRole('button', { name: /send reset link/i })).not.toBeInTheDocument();
  });

  // Whether an address exists must never be revealed, so a failure leaves the
  // form in place with no confirmation.
  it('keeps the form and hides the confirmation when the request fails', async () => {
    vi.spyOn(authService, 'forgotPassword').mockRejectedValue(new Error('Service unavailable'));

    renderWithProviders(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(authService.forgotPassword).toHaveBeenCalledWith({ email: 'test@example.com' });
    });
    expect(screen.queryByText(/the link is on its way/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('disables submit button during submission to prevent duplicate requests', () => {
    vi.spyOn(authService, 'forgotPassword').mockReturnValue(new Promise(() => {}) as never);

    renderWithProviders(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
  });

  it('offers a link back to sign in', () => {
    renderWithProviders(<ForgotPasswordPage />);

    const backLink = screen.getByRole('link', { name: /back to sign in/i });
    expect(backLink).toHaveAttribute('href', '/login');
  });
});
