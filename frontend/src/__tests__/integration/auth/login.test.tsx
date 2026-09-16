import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { LoginPage } from '@/pages/auth/login';
import * as authService from '@/lib/services/auth.service';

// Define mockNavigate at module level
const mockNavigate = vi.fn();

// Mock the services and navigation
vi.mock('@/lib/services/auth.service');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Create wrapper components that include both ThemeProvider and Router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('renders login form with email and password fields', () => {
    renderWithRouter(<LoginPage />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    renderWithRouter(<LoginPage />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email', async () => {
    renderWithRouter(<LoginPage />);
    
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });
  });

  it('calls login service with correct credentials', async () => {
    const mockUserData = { id: 'user-123', email: 'test@example.com', name: 'Test User' };
    vi.spyOn(authService, 'login').mockResolvedValue(undefined);
    vi.spyOn(authService, 'me').mockResolvedValue(mockUserData);

    renderWithRouter(<LoginPage />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });
  });

  it('handles login errors gracefully', async () => {
    const errorMessage = 'Invalid credentials';
    vi.spyOn(authService, 'login').mockRejectedValue(new Error(errorMessage));

    renderWithRouter(<LoginPage />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('redirects after successful login', async () => {
    const mockUserData = { id: 'user-123', email: 'test@example.com', name: 'Test User' };
    vi.spyOn(authService, 'login').mockResolvedValue(undefined);
    vi.spyOn(authService, 'me').mockResolvedValue(mockUserData);

    renderWithProviders(<LoginPage />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});