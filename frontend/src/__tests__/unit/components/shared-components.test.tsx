import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { BrandMark } from '@/components/brand-mark';
import { Skeleton } from '@/components/ui/skeleton';

describe('Shared Components', () => {
  describe('BrandMark Component', () => {
    it('renders without crashing', () => {
      expect(() => {
        render(<BrandMark />);
      }).not.toThrow();
    });

    it('applies custom class when provided', () => {
      render(<BrandMark className="custom-class" />);
      const brand = document.querySelector('.custom-class');
      expect(brand).toBeInTheDocument();
    });
  });

  describe('Skeleton Component', () => {
    it('renders without crashing', () => {
      expect(() => {
        render(<Skeleton />);
      }).not.toThrow();
    });

    it('applies custom styling', () => {
      render(<Skeleton className="h-10 w-10" />);
      const skeleton = document.querySelector('.h-10.w-10');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('ThemeToggle Component', () => {
    it('renders without crashing', () => {
      expect(() => {
        render(
          <ThemeProvider>
            <MemoryRouter>
              <ThemeToggle />
            </MemoryRouter>
          </ThemeProvider>
        );
      }).not.toThrow();
    });

    it('renders theme toggle button', () => {
      render(
        <ThemeProvider>
          <MemoryRouter>
            <ThemeToggle />
          </MemoryRouter>
        </ThemeProvider>
      );

      // Find the button by its aria-label or title
      const toggleButton = screen.getByLabelText(/switch to (light|dark) mode/i);
      expect(toggleButton).toBeInTheDocument();
    });
  });
});