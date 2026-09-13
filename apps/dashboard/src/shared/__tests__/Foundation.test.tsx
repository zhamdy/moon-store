import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { useDirection } from '../providers/DirectionProvider';
import { getFormFieldIds, useFormFieldIds, generateUniqueId } from '../lib/idUtils';
import { renderWithProviders } from '../tests/testUtils';

function DirectionConsumer() {
  const { direction, isRtl } = useDirection();
  return (
    <div>
      <span data-testid="dir-text">{direction}</span>
      <span data-testid="is-rtl">{isRtl ? 'true' : 'false'}</span>
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

  /**
   * Direction is derived from locale and stored nowhere else (#54). These assert the
   * single source of truth rather than the old writable API: the provider used to keep
   * its own persisted `moon-store-direction` state and write `<html dir>` itself, which
   * meant two independent answers to "which way does this page read" and a document that
   * could announce `lang="ar"` while laying out LTR.
   */
  describe('DirectionProvider and useDirection', () => {
    it('publishes the direction it is given', () => {
      renderWithProviders(<DirectionConsumer />, { direction: 'ltr' });
      expect(screen.getByTestId('dir-text').textContent).toBe('ltr');
      expect(screen.getByTestId('is-rtl').textContent).toBe('false');
    });

    it('publishes rtl when that is the locale direction', () => {
      renderWithProviders(<DirectionConsumer />, { direction: 'rtl' });
      expect(screen.getByTestId('dir-text').textContent).toBe('rtl');
      expect(screen.getByTestId('is-rtl').textContent).toBe('true');
    });

    it('does not write <html dir> itself — settingsStore is the only writer', () => {
      // The regression this guards: a second writer of `dir` racing the store, so the
      // attribute reflected whichever mounted last rather than the chosen locale.
      document.documentElement.setAttribute('dir', 'ltr');
      renderWithProviders(<DirectionConsumer />, { direction: 'rtl' });

      expect(screen.getByTestId('is-rtl').textContent).toBe('true');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    });

    it('keeps no direction of its own in storage', () => {
      renderWithProviders(<DirectionConsumer />, { direction: 'rtl' });
      expect(localStorage.getItem('moon-store-direction')).toBeNull();
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
