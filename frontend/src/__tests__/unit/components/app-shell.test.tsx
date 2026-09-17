import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/toast';
import { useAuthStore } from '@/lib/stores/auth.store';

// Mock the auth store
vi.mock('@/lib/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

// Mock window.scrollTo to prevent errors
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

describe('AppShell Component', () => {
  const mockUser = {
    id: 'user123',
    email: 'user@example.com',
    name: 'Test User',
    role: 'USER',
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    (useAuthStore as unknown as vi.Mock).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('renders children and sidebar', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppShell>
            <div>Test Children</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    // Check that children are rendered
    expect(screen.getByText('Test Children')).toBeInTheDocument();

    // Check that sidebar is present
    expect(screen.getByRole('banner')).toBeInTheDocument(); // Main header
    expect(screen.getByRole('navigation')).toBeInTheDocument(); // Sidebar navigation
  });

  it('displays user name in sidebar', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppShell>
            <div>Test Children</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    // Check that the user's name is displayed
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('displays fallback avatar initials when no name is provided', () => {
    // Mock user without a name
    (useAuthStore as unknown as vi.Mock).mockReturnValue({
      user: {
        ...mockUser,
        name: '', // Empty name to trigger fallback
      },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppShell>
            <div>Test Children</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    // Check that the email is used as fallback for the tooltip
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('displays toast container', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppShell>
            <div>Test Children</div>
            <Toaster />
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    // Check that the toast container is present
    expect(document.querySelector('[data-sonner-toast]')).toBeInTheDocument();
  });

  it('handles loading state', () => {
    (useAuthStore as unknown as vi.Mock).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });

    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppShell>
            <div>Test Children</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    // Should render children even when loading
    expect(screen.getByText('Test Children')).toBeInTheDocument();
  });
});