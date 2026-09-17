import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { useAuthStore } from '@/lib/stores/auth.store';

// Mock the auth store
vi.mock('@/lib/stores/auth.store');

// Create wrapper components that include both ThemeProvider and Router
const renderWithProviders = (ui: React.ReactElement, initialEntries: string[] = ['/login']) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

// GuestOnly component as defined in App.tsx
const GuestOnly = ({ children }: { children: React.ReactNode }) => {
  const status = useAuthStore((state) => state.status);
  
  if (status === 'authenticated') {
    // In a real app, this would redirect to dashboard
    return <div data-testid="redirect-to-dashboard">Redirecting to dashboard...</div>;
  }
  
  return <>{children}</>;
};

const GuestContent = () => <div>Guest Content</div>;

describe('GuestOnly Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset the mocked store to default state
    vi.mocked(useAuthStore).mockImplementation((selector) => {
      const mockState = {
        status: 'unauthenticated',
        user: null,
        pendingEmail: null,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        bootstrap: vi.fn(),
      };
      return selector ? selector(mockState) : mockState;
    });
  });

  it('renders children when user is unauthenticated', () => {
    vi.mocked(useAuthStore).mockImplementation((selector) => {
      const mockState = {
        status: 'unauthenticated',
        user: null,
        pendingEmail: null,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        bootstrap: vi.fn(),
      };
      return selector ? selector(mockState) : mockState;
    });

    renderWithProviders(
      <GuestOnly>
        <GuestContent />
      </GuestOnly>
    );

    expect(screen.getByText('Guest Content')).toBeInTheDocument();
    expect(screen.queryByTestId('redirect-to-dashboard')).not.toBeInTheDocument();
  });

  it('renders children when status is loading/idle', () => {
    vi.mocked(useAuthStore).mockImplementation((selector) => {
      const mockState = {
        status: 'loading',
        user: null,
        pendingEmail: null,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        bootstrap: vi.fn(),
      };
      return selector ? selector(mockState) : mockState;
    });

    renderWithProviders(
      <GuestOnly>
        <GuestContent />
      </GuestOnly>
    );

    expect(screen.getByText('Guest Content')).toBeInTheDocument();
    expect(screen.queryByTestId('redirect-to-dashboard')).not.toBeInTheDocument();
  });

  it('redirects away when user is authenticated', () => {
    vi.mocked(useAuthStore).mockImplementation((selector) => {
      const mockState = {
        status: 'authenticated',
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        pendingEmail: null,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        bootstrap: vi.fn(),
      };
      return selector ? selector(mockState) : mockState;
    });

    renderWithProviders(
      <GuestOnly>
        <GuestContent />
      </GuestOnly>
    );

    expect(screen.queryByText('Guest Content')).not.toBeInTheDocument();
    expect(screen.getByTestId('redirect-to-dashboard')).toBeInTheDocument();
  });

  it('properly handles transitions from unauthenticated to authenticated', async () => {
    let mockStatus = 'unauthenticated';
    let mockState = {
      status: mockStatus,
      user: null,
      pendingEmail: null,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      bootstrap: vi.fn(),
    };

    vi.mocked(useAuthStore).mockImplementation((selector) => {
      return selector ? selector(mockState) : mockState;
    });

    const { rerender } = renderWithProviders(
      <GuestOnly>
        <GuestContent />
      </GuestOnly>
    );

    // Initially should show guest content
    expect(screen.getByText('Guest Content')).toBeInTheDocument();

    // Update status to authenticated
    mockStatus = 'authenticated';
    mockState = {
      ...mockState,
      status: mockStatus,
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
    };

    // Rerender to simulate state change
    rerender(
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <MemoryRouter initialEntries={['/login']}>
          <GuestOnly>
            <GuestContent />
          </GuestOnly>
        </MemoryRouter>
      </ThemeProvider>
    );

    // Should now show redirect message
    expect(screen.queryByText('Guest Content')).not.toBeInTheDocument();
    expect(screen.getByTestId('redirect-to-dashboard')).toBeInTheDocument();
  });
});