import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { useDirection } from '../providers/DirectionProvider';
import { getFormFieldIds, useFormFieldIds, generateUniqueId } from '../lib/idUtils';
import { renderWithProviders } from '../tests/testUtils';

function DirectionConsumer() {
  const { direction, isRtl, setDirection, toggleDirection } = useDirection();
  return (
    <div>
      <span data-testid="dir-text">{direction}</span>
      <span data-testid="is-rtl">{isRtl ? 'true' : 'false'}</span>
      <button data-testid="set-rtl" onClick={() => setDirection('rtl')}>
        Set RTL
      </button>
      <button data-testid="toggle-dir" onClick={toggleDirection}>
        Toggle
      </button>
    </div>
  );
}

function FormIdsConsumer({ providedId }: { providedId?: string }) {
  const ids = useFormFieldIds(providedId);
  return (
    <div>
      <span data-testid="input-id">{ids.inputId}</span>
      <span data-testid="label-id">{ids.labelId}</span>
      <span data-testid="error-id">{ids.errorId}</span>
      <span data-testid="helper-id">{ids.helperId}</span>
    </div>
  );
}

describe('Foundation & Contracts', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('dir');
    localStorage.clear();
  });

  describe('DirectionProvider and useDirection', () => {
    it('defaults to ltr and syncs document dir', () => {
      renderWithProviders(<DirectionConsumer />, { direction: 'ltr' });
      expect(screen.getByTestId('dir-text').textContent).toBe('ltr');
      expect(screen.getByTestId('is-rtl').textContent).toBe('false');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    });

    it('allows toggling and updating direction to rtl', () => {
      renderWithProviders(<DirectionConsumer />, { direction: 'ltr' });
      const toggleBtn = screen.getByTestId('toggle-dir');
      fireEvent.click(toggleBtn);

      expect(screen.getByTestId('dir-text').textContent).toBe('rtl');
      expect(screen.getByTestId('is-rtl').textContent).toBe('true');
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');

      const setRtlBtn = screen.getByTestId('set-rtl');
      fireEvent.click(setRtlBtn);
      expect(screen.getByTestId('dir-text').textContent).toBe('rtl');
    });

    it('initializes with RTL when specified', () => {
      renderWithProviders(<DirectionConsumer />, { direction: 'rtl' });
      expect(screen.getByTestId('dir-text').textContent).toBe('rtl');
      expect(screen.getByTestId('is-rtl').textContent).toBe('true');
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    });
  });

  describe('idUtils', () => {
    it('generates predictable mapped IDs from baseId', () => {
      const ids = getFormFieldIds('user-email');
      expect(ids.inputId).toBe('user-email');
      expect(ids.labelId).toBe('user-email-label');
      expect(ids.errorId).toBe('user-email-error');
      expect(ids.helperId).toBe('user-email-helper');
      expect(ids.descriptionId).toBe('user-email-description');
    });

    it('useFormFieldIds respects provided ID and provides hook generated IDs', () => {
      const { unmount } = renderWithProviders(<FormIdsConsumer providedId="custom-input" />);
      expect(screen.getByTestId('input-id').textContent).toBe('custom-input');
      expect(screen.getByTestId('label-id').textContent).toBe('custom-input-label');
      unmount();

      renderWithProviders(<FormIdsConsumer />);
      expect(screen.getByTestId('input-id').textContent).toMatch(/^field-/);
      expect(screen.getByTestId('label-id').textContent).toMatch(/^field-.*-label$/);
    });

    it('generateUniqueId generates unique non-colliding IDs', () => {
      const id1 = generateUniqueId('test');
      const id2 = generateUniqueId('test');
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('test-')).toBe(true);
    });
  });
});
