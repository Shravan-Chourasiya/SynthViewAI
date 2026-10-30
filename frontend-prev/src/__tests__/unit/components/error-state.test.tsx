import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ErrorState } from '@/components/error-state';

describe('ErrorState Component', () => {
  it('renders error code, title, and body', () => {
    render(
      <ErrorState
        code="404"
        title="Page Not Found"
        body="The page you're looking for doesn't exist."
      />
    );

    expect(screen.getByText('Error 404')).toBeInTheDocument();
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
    expect(screen.getByText("The page you're looking for doesn't exist.")).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    render(
      <ErrorState
        code="500"
        title="Server Error"
        body="Something went wrong on our end."
      >
        <button>Try Again</button>
      </ErrorState>
    );

    expect(screen.getByText('Error 500')).toBeInTheDocument();
    expect(screen.getByText('Server Error')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('does not render children container when no children provided', () => {
    render(
      <ErrorState
        code="403"
        title="Access Denied"
        body="You don't have permission to view this page."
      />
    );

    expect(screen.getByText('Error 403')).toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    // Should not have any buttons or additional elements beyond the basic error info
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });
});