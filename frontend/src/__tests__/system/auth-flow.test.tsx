import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import LoginPage from '@/pages/auth/login';
import RegisterPage from '@/pages/auth/register';
import { useAuthStore } from '@/lib/stores/auth-store';

const mockNavigate = vi.fn();

vi.mock('@/lib/stores/auth-store', () => ({ useAuthStore: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const login = vi.fn();
const register = vi.fn();
const verifyOtp = vi.fn();

const renderPage = (ui: React.ReactElement) =>
  render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  );

const mockStore = (overrides: Record<string, unknown> = {}) => {
  vi.mocked(useAuthStore).mockImplementation((selector) => {
    const state = {
      status: 'unauthenticated',
      user: null,
      pendingEmail: null,
      error: null,
      login,
      register,
      verifyOtp,
      logout: vi.fn(),
      bootstrap: vi.fn(),
      ...overrides,
    };
    return selector ? selector(state as never) : (state as never);
  });
};

const fillRegistration = () => {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ada Okonkwo' } });
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'ada.o' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough' } });
  fireEvent.click(screen.getByRole('checkbox'));
};

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore();
  });

  it('walks from registration to the verification screen', async () => {
    register.mockResolvedValue(undefined);

    renderPage(<RegisterPage />);
    fillRegistration();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith(
        'Ada Okonkwo',
        'ada.o',
        'ada@example.com',
        'longenough',
      );
    });

    // A successful sign-up lands on the six-digit code screen.
    expect(await screen.findByText(/confirm it's really you/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument();
  });

  it('keeps the user on the form and shows why registration failed', async () => {
    register.mockRejectedValue(new Error('That email is already registered'));

    renderPage(<RegisterPage />);
    fillRegistration();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('That email is already registered')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('switches between the sign-in and sign-up panels', async () => {
    renderPage(<LoginPage />);

    expect(screen.getByText(/don't have an account\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByText(/start your first interview/i)).toBeInTheDocument();
    expect(screen.getByText(/already have an account\?/i)).toBeInTheDocument();
  });

  it('signs in and sends the user to the dashboard', async () => {
    login.mockResolvedValue(undefined);

    renderPage(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('ada@example.com', 'longenough');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('reports a rejected sign-in without navigating away', async () => {
    login.mockRejectedValue(new Error('Those credentials did not match'));

    renderPage(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText('Those credentials did not match')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
