import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthPage } from '@/components/auth/auth-page';
import { useAuthStore } from '@/lib/stores/auth-store';

vi.mock('@/lib/stores/auth-store', () => ({ useAuthStore: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockVerifyOtp = vi.fn();

const mockStore = (pendingEmail: string | null) => {
  vi.mocked(useAuthStore).mockImplementation((selector) => {
    const state = {
      status: 'unauthenticated',
      user: null,
      pendingEmail,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      verifyOtp: mockVerifyOtp,
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

describe('Verify Email Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyOtp.mockReset();
    mockStore('ada@example.com');
  });

  it('renders the verification form with the pending address', () => {
    renderWithProviders(<AuthPage initialMode="verify" />);

    expect(screen.getByText(/confirm it's really you/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify email/i })).toBeInTheDocument();
  });

  it('keeps the verify button disabled until a six-digit code is entered', () => {
    renderWithProviders(<AuthPage initialMode="verify" />);

    const submit = screen.getByRole('button', { name: /verify email/i });
    expect(submit).toBeDisabled();

    const code = screen.getByLabelText(/verification code/i);
    fireEvent.change(code, { target: { value: '12345' } });
    expect(submit).toBeDisabled();

    fireEvent.change(code, { target: { value: '123456' } });
    expect(submit).toBeEnabled();
  });

  it('drops non-numeric characters from the code', () => {
    renderWithProviders(<AuthPage initialMode="verify" />);

    const code = screen.getByLabelText(/verification code/i) as HTMLInputElement;
    fireEvent.change(code, { target: { value: '12-ab34cd56' } });
    expect(code.value).toBe('123456');
  });

  it('calls verifyOtp with the pending email and the entered code', async () => {
    mockVerifyOtp.mockResolvedValue(undefined);

    renderWithProviders(<AuthPage initialMode="verify" />);

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verify email/i }));

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith('ada@example.com', '123456');
    });
  });

  it('surfaces a rejected code in the form', async () => {
    mockVerifyOtp.mockRejectedValue(new Error('That code is not valid'));

    renderWithProviders(<AuthPage initialMode="verify" />);

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verify email/i }));

    await waitFor(() => {
      expect(screen.getByText('That code is not valid')).toBeInTheDocument();
    });
  });
});
