import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import LoginPage from '@/pages/auth/login';
import { authService } from '@/lib/services/auth';

// Define mockNavigate at module level
const mockNavigate = vi.fn();

// Mock the services and navigation
vi.mock('@/lib/services/auth');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderWithRouter = (ui: React.ReactElement) => (
  <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
    <MemoryRouter>{ui}</MemoryRouter>
  </ThemeProvider>
);

const renderPage = (ui: React.ReactElement) => render(renderWithRouter(ui));

/** The shape `authService.login` resolves with — the store derives the display name from it. */
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  username: 'testuser',
  userrole: 'user',
  accountStatus: 'active',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('renders login form with email and password fields', () => {
    renderPage(<LoginPage />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  // The redesigned form delegates validation to the browser's constraint
  // validation (`required` + `type="email"`) instead of rendering inline
  // messages, so the assertions check the constraints themselves.
  it('marks both fields required and rejects a malformed email', () => {
    renderPage(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();

    expect(emailInput.checkValidity()).toBe(false);

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    expect(emailInput.checkValidity()).toBe(false);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    expect(emailInput.checkValidity()).toBe(true);
  });

  it('calls login service with correct credentials', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue(mockUser);

    renderPage(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        deviceType: 'desktop',
      });
    });
  });

  it('handles login errors gracefully', async () => {
    const errorMessage = 'Invalid credentials';
    vi.spyOn(authService, 'login').mockRejectedValue(new Error(errorMessage));

    renderPage(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('redirects after successful login', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue(mockUser);

    renderPage(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });
});
