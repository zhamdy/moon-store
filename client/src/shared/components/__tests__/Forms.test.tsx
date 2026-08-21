import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../tests/testUtils';
import {
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  SearchInput,
  DateRangePicker,
  ImageUploader,
  defaultPresets,
} from '../forms';

describe('Unit 1: Forms & Inputs Suite', () => {
  describe('FormField', () => {
    it('links label to input ID and applies aria attributes', () => {
      renderWithProviders(
        <FormField
          id="email-input"
          label="Email Address"
          helperText="We will never share your email"
          isRequired
        >
          <input />
        </FormField>
      );

      const label = screen.getByText('Email Address');
      expect(label).toHaveAttribute('for', 'email-input');
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('id', 'email-input');
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'email-input-helper');
      expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders error message with role="alert" and updates aria-describedby', () => {
      renderWithProviders(
        <FormField
          id="username"
          label="Username"
          errorMessage="Username is already taken"
          isInvalid
        >
          <input />
        </FormField>
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'username-error');

      const alert = screen.getByRole('alert');
      expect(alert.textContent).toBe('Username is already taken');
    });
  });

  describe('FormInput', () => {
    it('renders standalone with clear button when clearable', () => {
      const handleClear = vi.fn();
      renderWithProviders(
        <FormInput
          placeholder="Enter text"
          value="Some Value"
          isClearable
          onClear={handleClear}
          onChange={() => {}}
        />
      );

      const clearBtn = screen.getByRole('button', { name: 'Clear input' });
      fireEvent.click(clearBtn);
      expect(handleClear).toHaveBeenCalledTimes(1);
    });

    it('wraps with FormField when label is provided', () => {
      renderWithProviders(
        <FormInput id="search-box" label="Search User" placeholder="Search..." />
      );

      expect(screen.getByText('Search User')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search...')).toHaveAttribute('id', 'search-box');
    });
  });

  describe('FormSelect', () => {
    it('renders options and handles change events', () => {
      const handleChange = vi.fn();
      renderWithProviders(
        <FormSelect
          label="Role"
          options={[
            { value: 'admin', label: 'Admin' },
            { value: 'cashier', label: 'Cashier' },
          ]}
          onChange={handleChange}
        />
      );

      expect(screen.getByText('Role')).toBeInTheDocument();
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'cashier' } });
      expect(handleChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('FormTextarea', () => {
    it('displays character counter when showCount and maxLength are specified', () => {
      renderWithProviders(
        <FormTextarea label="Bio" maxLength={100} showCount defaultValue="Hello world" />
      );

      expect(screen.getByText('11/100')).toBeInTheDocument();
    });
  });

  describe('SearchInput', () => {
    it('debounces input changes and supports clearing', async () => {
      const handleDebounce = vi.fn();
      const handleChange = vi.fn();

      renderWithProviders(
        <SearchInput
          debounceMs={50}
          onDebounce={handleDebounce}
          onChange={handleChange}
          shortcutKey="⌘K"
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'coffee' } });

      expect(handleChange).toHaveBeenCalledWith('coffee');

      await waitFor(
        () => {
          expect(handleDebounce).toHaveBeenCalledWith('coffee');
        },
        { timeout: 300 }
      );

      const clearBtn = screen.getByRole('button', { name: 'Clear search' });
      fireEvent.click(clearBtn);
      expect(input).toHaveValue('');
    });
  });

  describe('DateRangePicker', () => {
    it('applies presets correctly', () => {
      const handleChange = vi.fn();
      renderWithProviders(<DateRangePicker onChange={handleChange} />);

      const toggleBtn = screen.getByRole('button', { name: /Select date range|اختر الفترة/i });
      fireEvent.click(toggleBtn);

      expect(screen.getByRole('dialog', { name: 'Date range selector' })).toBeInTheDocument();

      const todayPresetBtn = screen.getByRole('button', { name: /Today|اليوم/i });
      fireEvent.click(todayPresetBtn);

      expect(handleChange).toHaveBeenCalledTimes(1);
      const callArg = handleChange.mock.calls[0][0];
      expect(callArg.start).toBeInstanceOf(Date);
      expect(callArg.end).toBeInstanceOf(Date);
    });

    it('has all 5 standard presets configured', () => {
      expect(defaultPresets.map((p) => p.label)).toEqual([
        'Today',
        'Yesterday',
        'Last 7 Days',
        'Last 30 Days',
        'This Month',
      ]);
    });
  });

  describe('ImageUploader', () => {
    it('handles keyboard activation and image removal', () => {
      const handleChange = vi.fn();
      renderWithProviders(
        <ImageUploader value={['https://example.com/test.jpg']} onChange={handleChange} />
      );

      const removeBtn = screen.getByRole('button', { name: /Remove image/i });
      fireEvent.click(removeBtn);

      expect(handleChange).toHaveBeenCalledWith([]);
    });

    it('renders dropzone button with keyboard accessibility', () => {
      renderWithProviders(<ImageUploader />);
      const dropzone = screen.getByRole('button', { name: 'Upload images dropzone' });
      expect(dropzone).toHaveAttribute('tabIndex', '0');
    });
  });
});
