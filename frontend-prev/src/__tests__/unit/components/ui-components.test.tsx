import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

describe('UI Components', () => {
  describe('Button Component', () => {
    it('renders button with text', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('can be disabled', () => {
      render(<Button disabled>Disabled Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('renders with different variants', () => {
      render(
        <>
          <Button variant="default">Default Button</Button>
          <Button variant="ghost">Ghost Button</Button>
        </>
      );
      expect(screen.getByRole('button', { name: 'Default Button' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ghost Button' })).toBeInTheDocument();
    });
  });

  describe('Input Component', () => {
    it('renders input with placeholder', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('can be controlled', () => {
      render(<Input value="controlled value" onChange={() => {}} />);
      const input = screen.getByDisplayValue('controlled value');
      expect(input).toBeInTheDocument();
    });

    it('renders as textbox', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Label Component', () => {
    it('renders label with text', () => {
      render(<Label htmlFor="test-input">Test Label</Label>);
      expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('connects to input via htmlFor', () => {
      render(
        <>
          <Label htmlFor="connected-input">Connected Label</Label>
          <Input id="connected-input" />
        </>
      );
      const label = screen.getByText('Connected Label');
      const input = screen.getByRole('textbox');
      expect(label).toHaveAttribute('for', 'connected-input');
    });
  });

  describe('Textarea Component', () => {
    it('renders textarea with placeholder', () => {
      render(<Textarea placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('can be controlled', () => {
      render(<Textarea value="controlled value" onChange={() => {}} />);
      const textarea = screen.getByDisplayValue('controlled value');
      expect(textarea).toBeInTheDocument();
    });

    it('renders as textarea', () => {
      render(<Textarea />);
      const textarea = screen.getByRole('textbox');
      expect(textarea.tagName).toBe('TEXTAREA');
    });
  });

  describe('Card Component', () => {
    it('renders card with header, content, and footer', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      );

      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
      expect(screen.getByText('Footer')).toBeInTheDocument();
    });

    it('renders card content', () => {
      render(<Card>Card Content</Card>);
      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });
  });

  describe('Alert Component', () => {
    it('renders alert with content', () => {
      render(
        <Alert>
          Alert content
        </Alert>
      );

      expect(screen.getByText('Alert content')).toBeInTheDocument();
    });

    it('renders with role alert', () => {
      render(<Alert>Alert content</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });
  });

  describe('Badge Component', () => {
    it('renders badge with text', () => {
      render(<Badge>Badge Text</Badge>);
      expect(screen.getByText('Badge Text')).toBeInTheDocument();
    });

    it('renders with different variants', () => {
      render(
        <>
          <Badge variant="default">Default Badge</Badge>
          <Badge variant="strong">Strong Badge</Badge>
        </>
      );
      expect(screen.getByText('Default Badge')).toBeInTheDocument();
      expect(screen.getByText('Strong Badge')).toBeInTheDocument();
    });
  });
});