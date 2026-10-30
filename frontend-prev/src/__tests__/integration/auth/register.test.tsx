import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { RegisterForm } from '@/components/auth/register-form';
import { useAuthStore } from '@/lib/stores/auth.store';

// Define mockNavigate at module level
const mockNavigate = vi.fn();

// Mock the services and navigation
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the auth store
vi.mock('@/lib/stores/auth.store', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useAuthStore: vi.fn(),
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

// Test setup helper
const setupTest = () => {
  const mockRegister = vi.fn();
  
  vi.mocked(useAuthStore).mockReturnValue({
    register: mockRegister,
    status: 'unauthenticated',
    user: null,
    pendingEmail: null,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    bootstrap: vi.fn(),
  });

  const utils = renderWithProviders(<RegisterForm onSuccess={mockNavigate} />);
  
  const inputs = {
    name: screen.getByLabelText('Full name'),
    username: screen.getByLabelText('Username'),
    email: screen.getByLabelText('Email'),
    password: screen.getByLabelText('Password'),
    confirmPassword: screen.getByLabelText('Confirm password'),
    submit: screen.getByRole('button', { name: /create account/i })
  };
  
  return { mockRegister, mockNavigate, ...utils, ...inputs };
};

describe('Register Form Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Mock the auth store with register function
    vi.mocked(useAuthStore).mockReturnValue({
      register: vi.fn(),
      status: 'unauthenticated',
      user: null,
      pendingEmail: null,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      bootstrap: vi.fn(),
    });
  });

  it('renders registration form with all required fields', () => {
    renderWithProviders(<RegisterForm onSuccess={mockNavigate} />);

    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows field validation errors for empty fields', async () => {
    renderWithProviders(<RegisterForm onSuccess={mockNavigate} />);
    
    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter your name\./i)).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email format', async () => {
    renderWithProviders(<RegisterForm onSuccess={mockNavigate} />);
    
    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address\./i)).toBeInTheDocument();
    });
  });

  it('shows validation errors for weak passwords', async () => {
    renderWithProviders(<RegisterForm onSuccess={mockNavigate} />);
    
    const nameInput = screen.getByLabelText('Full name');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const confirmInput = screen.getByLabelText('Confirm password');
    
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'weak' } }); // Too short
    fireEvent.change(confirmInput, { target: { value: 'weak' } });

    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // Password validation error message
      expect(screen.getByText(/password does not meet the requirements below\./i)).toBeInTheDocument();
    });
  });

  it('calls register store action with correct parameters on successful submission', async () => {
    const mockRegister = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuthStore).mockReturnValue({
      register: mockRegister,
      status: 'unauthenticated',
      user: null,
      pendingEmail: null,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      bootstrap: vi.fn(),
    });

    renderWithProviders(<RegisterForm onSuccess={mockNavigate} />);
    
    const nameInput = screen.getByLabelText('Full name');
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const confirmInput = screen.getByLabelText('Confirm password');
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(usernameInput, { target: { value: 'johndoe' } });
    fireEvent.change(emailInput, { target: { value: 'john.doe@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
    fireEvent.change(confirmInput, { target: { value: 'SecurePass123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'John Doe',
        'johndoe',
        'john.doe@example.com',
        'SecurePass123!'
      );
    });
  });

  it('calls onSuccess after successful registration', async () => {
    const mockRegister = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuthStore).mockReturnValue({
      register: mockRegister,
      status: 'unauthenticated',
      user: null,
      pendingEmail: null,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      bootstrap: vi.fn(),
    });

    renderWithProviders(<RegisterForm onSuccess={mockNavigate} />);
    
    const nameInput = screen.getByLabelText('Full name');
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const confirmInput = screen.getByLabelText('Confirm password');
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(usernameInput, { target: { value: 'johndoe' } });
    fireEvent.change(emailInput, { target: { value: 'john.doe@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
    fireEvent.change(confirmInput, { target: { value: 'SecurePass123!' } });
    fireEvent.click(submitButton);

    // Wait for the success state and navigation
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('john.doe@example.com');
    });
  });

  it('shows error message on registration failure', async () => {
    const errorMessage = 'Email already exists';
    const { mockRegister, ...rest } = setupTest();
    
    // Mock the rejected value
    mockRegister.mockRejectedValueOnce(new Error(errorMessage));
    
    const { name, username, email, password, confirmPassword, submit } = rest;
    
    // Fill in valid values for all fields
    fireEvent.change(name, { target: { value: 'John Doe' } });
    fireEvent.change(username, { target: { value: 'johndoe' } });
    fireEvent.change(email, { target: { value: 'existing@example.com' } });
    fireEvent.change(password, { target: { value: 'SecurePass123!' } });
    fireEvent.change(confirmPassword, { target: { value: 'SecurePass123!' } });
    
    // Click submit button
    fireEvent.click(submit);
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows error message on registration failure', async () => {
    const errorMessage = 'Email already exists';
    const mockRegister = vi.fn().mockRejectedValue(new Error(errorMessage));
    vi.mocked(useAuthStore).mockReturnValue({
      register: mockRegister,
      status: 'unauthenticated',
      user: null,
      pendingEmail: null,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      bootstrap: vi.fn(),
    });

    renderWithProviders(<RegisterForm onSuccess={mockNavigate} />);
    
    const nameInput = screen.getByLabelText('Full name');
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const confirmInput = screen.getByLabelText('Confirm password');
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(usernameInput, { target: { value: 'johndoe' } });
    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
    fireEvent.change(confirmInput, { target: { value: 'SecurePass123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});