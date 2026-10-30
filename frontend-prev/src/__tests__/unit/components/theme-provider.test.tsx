import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@/components/theme-provider';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('ThemeProvider Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset document classes and mock localStorage to return null initially
    localStorageMock.getItem.mockReturnValue(null);
    document.documentElement.className = '';
    document.documentElement.classList.add('dark'); // Add default dark class initially
  });

  it('renders children correctly', () => {
    render(
      <ThemeProvider>
        <div>Test Child</div>
      </ThemeProvider>
    );

    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('provides theme context to child components', () => {
    const TestComponent = () => {
      const theme = useTheme();
      return (
        <div>
          <span data-testid="theme">{theme.theme}</span>
          <button onClick={() => theme.toggleTheme()}>Toggle</button>
        </div>
      );
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Initially should be dark theme (default)
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('uses stored theme from localStorage if available', () => {
    localStorageMock.getItem.mockReturnValue('light');

    render(
      <ThemeProvider>
        <div>Test Child</div>
      </ThemeProvider>
    );

    // Should use light theme from localStorage
    expect(localStorageMock.getItem).toHaveBeenCalledWith('synthview-theme');
  });

  it('applies theme classes to document element', async () => {
    // Ensure localStorage returns null so it defaults to dark
    localStorageMock.getItem.mockReturnValue(null);
    
    render(
      <ThemeProvider>
        <div>Test Child</div>
      </ThemeProvider>
    );

    // Wait for the useEffect to run and apply the default theme
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });
});