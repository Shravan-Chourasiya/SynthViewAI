import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { SiteNav } from '@/components/site-nav';

// Mock window.scrollTo to prevent errors
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

describe('SiteNav Component', () => {
  it('renders without crashing', () => {
    expect(() => {
      render(
        <ThemeProvider>
          <MemoryRouter initialEntries={['/']}>
            <SiteNav />
          </MemoryRouter>
        </ThemeProvider>
      );
    }).not.toThrow();
    
    // Just check that essential elements are present
    // The text "SynthView AI" is split across elements, so match differently
    expect(screen.getByText(/SynthView/)).toBeInTheDocument();
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
  });

  it('renders navigation structure', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <SiteNav />
        </MemoryRouter>
      </ThemeProvider>
    );

    // Check for the main header element
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
    
    // Check that the navigation exists
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });
});