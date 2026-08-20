import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card';
import { Badge } from '../badge';
import { Switch } from '../switch';
import { Input } from '../input';

describe('Shared UI Components (HeroUI Wrappers)', () => {
  describe('Button', () => {
    it('renders button with text and handles clicks', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);

      const btn = screen.getByRole('button', { name: /Click Me/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders with variants and disabled state', () => {
      const handleClick = vi.fn();
      render(
        <Button variant="outline" disabled onClick={handleClick}>
          Disabled Btn
        </Button>
      );

      const btn = screen.getByRole('button', { name: /Disabled Btn/i });
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('handles isLoading state', () => {
      render(<Button isLoading>Loading Action</Button>);
      const btn = screen.getByRole('button', { name: /Loading Action/i });
      expect(btn).toBeDisabled();
    });
  });

  describe('Card', () => {
    it('renders card with header, title, description, content, and footer', () => {
      render(
        <Card data-testid="test-card">
          <CardHeader>
            <CardTitle>Moon Store</CardTitle>
            <CardDescription>Luxury Fashion</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Main product content</p>
          </CardContent>
          <CardFooter>
            <Button size="sm">Action</Button>
          </CardFooter>
        </Card>
      );

      expect(screen.getByTestId('test-card')).toBeInTheDocument();
      expect(screen.getByText('Moon Store')).toBeInTheDocument();
      expect(screen.getByText('Luxury Fashion')).toBeInTheDocument();
      expect(screen.getByText('Main product content')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Action/i })).toBeInTheDocument();
    });
  });

  describe('Badge', () => {
    it('renders badge with variants', () => {
      render(
        <div>
          <Badge variant="gold">Gold Tag</Badge>
          <Badge variant="success">Active</Badge>
          <Badge variant="destructive">Out of Stock</Badge>
        </div>
      );

      expect(screen.getByText('Gold Tag')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Out of Stock')).toBeInTheDocument();
    });
  });

  describe('Switch', () => {
    it('handles switch state change', () => {
      const handleChange = vi.fn();
      render(<Switch checked={false} onCheckedChange={handleChange} aria-label="Toggle setting" />);

      const switchElem = screen.getByRole('switch');
      expect(switchElem).toBeInTheDocument();
      fireEvent.click(switchElem);
      expect(handleChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Input', () => {
    it('handles typing in input', () => {
      const handleChange = vi.fn();
      render(<Input placeholder="Search products..." onChange={handleChange} />);

      const inputElem = screen.getByPlaceholderText('Search products...');
      fireEvent.change(inputElem, { target: { value: 'Silk' } });
      expect(handleChange).toHaveBeenCalled();
    });
  });
});
