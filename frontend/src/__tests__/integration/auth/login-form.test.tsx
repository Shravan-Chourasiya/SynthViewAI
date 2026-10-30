import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import LoginPage from '@/pages/auth/login';
import { useAuthStore } from '@/lib/stores/auth-store';

vi.mock('@/lib/stores/auth-store', () => ({ useAuthStore: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockLogin = vi.fn();

const mockState = () => ({
  status: 'unauthenticated',
  user: null,
  pendingEmail: null,
  error: null,
  login: mockLogin,
  register: vi.fn(),
  verifyOtp: vi.fn(),
  logout: vi.fn(),
  bootstrap: vi.fn(),
});

const mockStore = (overrides: Record<string, unknown> = {}) => {
  vi.mocked(useAuthStore).mockImplementation((selector) => {
    const state = { ...mockState(), ...overrides };
    return selector ? selector(state as never) : (state as never);
  });
};

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );

describe('Login Form Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockReset();
    mockStore();
  });

  it('renders login form with email and password fields', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  // Validation is delegated to the browser (`required`, `type="email"`), so the
  // constraints themselves are what the form relies on.
  it('marks both fields required and rejects a malformed email', () => {
    renderWithProviders(<LoginPage />);

    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;

    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
    expect(emailInput.checkValidity()).toBe(false);

    emailInput.value = 'not-an-email';
    expect(emailInput.checkValidity()).toBe(false);

    emailInput.value = 'test@example.com';
    expect(emailInput.checkValidity()).toBe(true);
  });

  it('calls login store action with correct credentials on successful submission', async () => {
    mockLogin.mockResolvedValue(undefined);

    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('handles login errors gracefully', async () => {
    const errorMessage = 'Invalid credentials';
    mockLogin.mockRejectedValue(new Error(errorMessage));

    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('offers a way to the registration form', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByText(/don't have an account\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });
});
