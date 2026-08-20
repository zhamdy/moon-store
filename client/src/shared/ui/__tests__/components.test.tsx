import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card';
import { Badge } from '../badge';
import { Switch } from '../switch';
import { Input } from '../input';
import { Textarea } from '../textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '../alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../select';
import { Checkbox } from '../checkbox';
import { RadioGroup, RadioGroupItem } from '../radio-group';
import { Popover, PopoverTrigger, PopoverContent } from '../popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '../tooltip';
import { Separator } from '../separator';
import { Skeleton } from '../skeleton';
import { Label } from '../label';

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

  describe('Input and Textarea', () => {
    it('handles typing in input and textarea', () => {
      const handleInputChange = vi.fn();
      const handleTextareaChange = vi.fn();
      render(
        <div>
          <Input placeholder="Search products..." onChange={handleInputChange} />
          <Textarea placeholder="Enter description..." onChange={handleTextareaChange} />
        </div>
      );

      const inputElem = screen.getByPlaceholderText('Search products...');
      fireEvent.change(inputElem, { target: { value: 'Silk' } });
      expect(handleInputChange).toHaveBeenCalled();

      const textareaElem = screen.getByPlaceholderText('Enter description...');
      fireEvent.change(textareaElem, { target: { value: 'Luxury silk dress' } });
      expect(handleTextareaChange).toHaveBeenCalled();
    });
  });

  describe('Dialog', () => {
    it('renders dialog when open', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Item</DialogTitle>
              <DialogDescription>Dialog body description</DialogDescription>
            </DialogHeader>
            <div>Form Fields</div>
            <DialogFooter>
              <Button>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText('Edit Item')).toBeInTheDocument();
      expect(screen.getByText('Dialog body description')).toBeInTheDocument();
      expect(screen.getByText('Form Fields')).toBeInTheDocument();
    });
  });

  describe('AlertDialog', () => {
    it('renders alert dialog with action and cancel', () => {
      const handleConfirm = vi.fn();
      render(
        <AlertDialog open={true}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      expect(screen.getByText('Are you sure?')).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: /Confirm/i });
      fireEvent.click(confirmBtn);
      expect(handleConfirm).toHaveBeenCalled();
    });
  });

  describe('Tabs', () => {
    it('switches tabs correctly', () => {
      const handleTabChange = vi.fn();
      render(
        <Tabs defaultValue="account" onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>
          <TabsContent value="account">Account Details</TabsContent>
          <TabsContent value="password">Password Change</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Account Details')).toBeInTheDocument();
      expect(screen.queryByText('Password Change')).not.toBeInTheDocument();
    });
  });

  describe('Select', () => {
    it('renders select with options and handles selection', () => {
      const handleChange = vi.fn();
      render(
        <Select value="ar" onValueChange={handleChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ar">Arabic</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      );

      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeInTheDocument();
      fireEvent.click(trigger);

      const englishOption = screen.getByText('English');
      fireEvent.click(englishOption);
      expect(handleChange).toHaveBeenCalledWith('en');
    });
  });

  describe('Checkbox and RadioGroup', () => {
    it('renders checkbox and radio group', () => {
      const handleCheck = vi.fn();
      const handleRadio = vi.fn();
      render(
        <div>
          <Checkbox checked={false} onCheckedChange={handleCheck} aria-label="Accept terms" />
          <RadioGroup value="opt1" onValueChange={handleRadio}>
            <RadioGroupItem value="opt1">Option 1</RadioGroupItem>
            <RadioGroupItem value="opt2">Option 2</RadioGroupItem>
          </RadioGroup>
        </div>
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      fireEvent.click(checkbox);
      expect(handleCheck).toHaveBeenCalledWith(true);

      const radio1 = screen.getByRole('radio', { name: /Option 1/i });
      expect(radio1).toBeInTheDocument();
    });
  });

  describe('Utility Components', () => {
    it('renders separator, skeleton, label, tooltip, and popover', () => {
      render(
        <div>
          <Label htmlFor="username">Username</Label>
          <Separator />
          <Skeleton className="h-4 w-20" />
          <Tooltip>
            <TooltipTrigger>
              <button type="button">Hover Me</button>
            </TooltipTrigger>
            <TooltipContent>Helpful info</TooltipContent>
          </Tooltip>
          <Popover open={true}>
            <PopoverTrigger>
              <button type="button">Open Popover</button>
            </PopoverTrigger>
            <PopoverContent>Popover Details</PopoverContent>
          </Popover>
        </div>
      );

      expect(screen.getByText('Username')).toBeInTheDocument();
      expect(screen.getByText('Popover Details')).toBeInTheDocument();
    });
  });
});
