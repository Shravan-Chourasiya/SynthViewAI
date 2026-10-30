import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import RegisterPage from '@/pages/auth/register';
import { useAuthStore } from '@/lib/stores/auth-store';

vi.mock('@/lib/stores/auth-store', () => ({ useAuthStore: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockRegister = vi.fn();

const mockStore = () => {
  vi.mocked(useAuthStore).mockImplementation((selector) => {
    const state = {
      status: 'unauthenticated',
      user: null,
      pendingEmail: null,
      error: null,
      login: vi.fn(),
      register: mockRegister,
      verifyOtp: vi.fn(),
      logout: vi.fn(),
      bootstrap: vi.fn(),
    };
    return selector ? selector(state as never) : (state as never);
  });
};

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );

const fillForm = () => {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ada Okonkwo' } });
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'ada.o' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough' } });
  // The terms checkbox is `required`: the browser (and jsdom) refuse to submit
  // until it is ticked, so the form's own submit path never runs without it.
  fireEvent.click(screen.getByRole('checkbox'));
};

describe('Register Form Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegister.mockReset();
    mockStore();
  });

  it('renders registration form with all required fields', () => {
    renderWithProviders(<RegisterPage />);

    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('constrains the password and email fields', () => {
    renderWithProviders(<RegisterPage />);

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;

    expect(passwordInput.minLength).toBe(8);
    expect(passwordInput).toBeRequired();
    expect(emailInput).toBeRequired();
    expect(emailInput.type).toBe('email');
  });

  it('requires accepting the terms before the form can submit', () => {
    renderWithProviders(<RegisterPage />);

    const terms = screen.getByRole('checkbox') as HTMLInputElement;
    expect(terms).toBeRequired();
    expect(terms.checked).toBe(false);
  });

  it('calls the register store action with the typed details', async () => {
    mockRegister.mockResolvedValue(undefined);

    renderWithProviders(<RegisterPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('Ada Okonkwo', 'ada.o', 'ada@example.com', 'longenough');
    });
  });

  it('surfaces a rejected registration in the form', async () => {
    mockRegister.mockRejectedValue(new Error('That email is already registered'));

    renderWithProviders(<RegisterPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('That email is already registered')).toBeInTheDocument();
    });
  });
});
