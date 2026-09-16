import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { LoginPage } from '@/pages/auth/login';
import { RegisterPage } from '@/pages/auth/register';
import * as authService from '@/lib/services/auth.service';
import { useAuthStore } from '@/lib/stores/auth.store';

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
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Reset auth store state
    useAuthStore.setState({
      user: null,
      pendingEmail: null,
      status: "idle",
      error: null,
    });
  });

  it('allows user to register, login, and navigate through the app', async () => {
    // Mock registration success
    vi.spyOn(authService, 'register').mockResolvedValue(undefined);
    
    renderWithProviders(<RegisterPage />);
    
    // Fill in registration form
    const fullNameInput = screen.getByPlaceholderText(/first and last name/i);
    const usernameInput = screen.getByPlaceholderText(/username/i);
    const emailInput = screen.getAllByLabelText(/email/i)[0]; // Get the first email input
    const passwordInput = screen.getByLabelText(/password/i);
    
    fireEvent.change(fullNameInput, { target: { value: 'Test User' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    const registerButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(registerButton);
    
    // Wait for registration to complete and redirect
    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User'
      });
    });
    
    // Should now be on the login page waiting for OTP
    // For this test, we'll simulate the flow continuing
    
    // Now test login
    vi.spyOn(authService, 'login').mockResolvedValue(undefined);
    const mockUserData = { id: 'user-123', email: 'test@example.com', name: 'Test User' };
    vi.spyOn(authService, 'me').mockResolvedValue(mockUserData);
    
    renderWithProviders(<LoginPage />);
    
    // Fill in login form
    const loginEmailInput = screen.getAllByLabelText(/email/i)[0]; // Get the first email input
    const loginPasswordInput = screen.getByLabelText(/password/i);
    
    fireEvent.change(loginEmailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(loginPasswordInput, { target: { value: 'password123' } });
    
    const loginButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(loginButton);
    
    // Wait for navigation after login
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles registration with existing email error', async () => {
    const errorMessage = 'Email already exists';
    vi.spyOn(authService, 'register').mockRejectedValue(new Error(errorMessage));
    
    renderWithProviders(<RegisterPage />);
    
    // Fill in registration form with existing email
    const fullNameInput = screen.getByPlaceholderText(/first and last name/i);
    const usernameInput = screen.getByPlaceholderText(/username/i);
    const emailInput = screen.getAllByLabelText(/email/i)[0];
    const passwordInput = screen.getByLabelText(/password/i);
    
    fireEvent.change(fullNameInput, { target: { value: 'Test User' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    const registerButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(registerButton);
    
    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('handles login with invalid credentials', async () => {
    const errorMessage = 'Invalid credentials';
    vi.spyOn(authService, 'login').mockRejectedValue(new Error(errorMessage));
    
    renderWithProviders(<LoginPage />);
    
    // Fill in login form with wrong credentials
    const emailInput = screen.getAllByLabelText(/email/i)[0];
    const passwordInput = screen.getByLabelText(/password/i);
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    
    const loginButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(loginButton);
    
    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('allows navigation from login to register and back', async () => {
    renderWithProviders(<LoginPage />);
    
    // Click on "Don't have an account? Create one" link
    const registerLink = screen.getByText(/don't have an account\? create one/i);
    fireEvent.click(registerLink);
    
    // Should render the register form
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/email/i)[0]).toBeInTheDocument();
    
    // Click on "Already have an account? Sign in" link
    const loginLink = screen.getByText(/already have an account\? sign in/i);
    fireEvent.click(loginLink);
    
    // Should render the login form again
    expect(screen.getAllByLabelText(/email/i)[0]).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });
});