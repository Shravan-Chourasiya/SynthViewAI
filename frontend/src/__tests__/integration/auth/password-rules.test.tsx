import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import LoginPage from '@/pages/auth/login';
import RegisterPage from '@/pages/auth/register';
import ResetPasswordPage from '@/pages/auth/reset-password';
import { useAuthStore } from '@/lib/stores/auth-store';

vi.mock('@/lib/stores/auth-store', () => ({ useAuthStore: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const renderWithProviders = (ui: React.ReactElement, entry = '/') =>
  render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
    </ThemeProvider>
  );

/**
 * The dedicated PasswordChecklist component was retired with the old auth
 * screens: password rules are now enforced by the inputs themselves
 * (`required`, `minLength`, `type="password"`). These tests pin that contract.
 */
describe('Password rules across the auth forms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockImplementation((selector) => {
      const state = {
        status: 'unauthenticated',
        user: null,
        pendingEmail: null,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        verifyOtp: vi.fn(),
        logout: vi.fn(),
        bootstrap: vi.fn(),
      };
      return selector ? selector(state as never) : (state as never);
    });
  });

  it('keeps the login password hidden and required', () => {
    renderWithProviders(<LoginPage />);
    const loginPassword = screen.getByLabelText('Password') as HTMLInputElement;
    expect(loginPassword.type).toBe('password');
    expect(loginPassword).toBeRequired();
  });

  it('advertises an eight character minimum on registration', () => {
    cleanup();
    renderWithProviders(<RegisterPage />);

    const registerPassword = screen.getByLabelText('Password') as HTMLInputElement;
    expect(registerPassword.type).toBe('password');
    expect(registerPassword).toBeRequired();
    // jsdom does not run the constraint validator for `minLength`, so pin the
    // attribute the browser actually enforces.
    expect(registerPassword.minLength).toBe(8);
  });

  it('blocks a reset submission while the confirmation does not match', () => {
    renderWithProviders(<ResetPasswordPage />, '/reset-password?email=a%40b.com&otp=123456');

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'NewPassword123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'DifferentPass1!' } });

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled();
  });
});
