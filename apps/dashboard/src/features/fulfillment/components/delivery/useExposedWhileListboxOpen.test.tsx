import { describe, expect, it } from 'vitest';
import { useRef } from 'react';
import { render } from '@testing-library/react';
import { useExposedWhileListboxOpen } from './useExposedWhileListboxOpen';

function Field({ isOpen }: { isOpen: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useExposedWhileListboxOpen(ref, isOpen);
  return (
    <div aria-hidden="true" data-testid="portal-wrapper">
      <div data-testid="dialog">
        <div ref={ref}>
          <input aria-label="Select Customer" />
        </div>
      </div>
    </div>
  );
}

/*
 * #113: HeroUI's popover hides everything outside itself when it opens, which from
 * inside a modal includes the wrapper the dialog is portaled into -- so the combobox
 * that owns the open listbox is hidden by an ancestor. jsdom cannot compute an
 * accessible tree, so what is asserted here is the attribute the browser was measured
 * reacting to (`ignoredReasons: ['ariaHiddenSubtree']`), not the outcome.
 */
describe('useExposedWhileListboxOpen', () => {
  it('drops aria-hidden from the ancestors once the listbox opens', () => {
    const { getByTestId, rerender } = render(<Field isOpen={false} />);

    expect(getByTestId('portal-wrapper')).toHaveAttribute('aria-hidden', 'true');

    rerender(<Field isOpen />);
    expect(getByTestId('portal-wrapper')).not.toHaveAttribute('aria-hidden');
  });

  it('does not put aria-hidden back when the listbox closes', () => {
    // ariaHideOutside removes those attributes in its own cleanup. Restoring one
    // after that cleanup has run would leave the dialog hidden permanently.
    const { getByTestId, rerender } = render(<Field isOpen />);
    expect(getByTestId('portal-wrapper')).not.toHaveAttribute('aria-hidden');

    rerender(<Field isOpen={false} />);
    expect(getByTestId('portal-wrapper')).not.toHaveAttribute('aria-hidden');
  });
});
