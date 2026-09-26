// @vitest-environment jsdom
/**
 * MED-7: the storefront had **zero** component tests. Every pure rule is well covered —
 * 24 named cases in `variant-selection.test.ts` alone — but nothing exercised the panel
 * opening, `askFor` moving focus to the first unanswered group, Escape restoring focus,
 * the sold-out disc staying focusable, or that one press never adds a default silently.
 *
 * That gap is why three commits could rewrite this control on a branch with no
 * regression check, and why MED-5's dead click band was found by reading CSS rather than
 * by a failing test. `QuickAdd` is the one client island whose *behaviour*, not just its
 * model, is the contract (`apps/storefront/CLAUDE.md` → Cart → Surfaces).
 *
 * jsdom is opted into per file, so the DOM-free suites keep their environment.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { useCartActions } from '../store/cart-store';
import type { QuickAddModel } from '../utils/quick-add-model';
import type { QuickAddStrings } from '../utils/bag-strings';
import { QuickAdd } from './quick-add';

type AddArgs = Parameters<ReturnType<typeof useCartActions>['add']>;
const add = vi.fn<(...args: AddArgs) => { outcome: 'added'; addedQuantity: number }>(() => ({
  outcome: 'added',
  addedQuantity: 1,
}));

vi.mock('../store/cart-store', () => ({
  useCartActions: () => ({ add }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/components/feedback/show-toast', () => ({
  showToast: vi.fn(),
  dismissToast: vi.fn(),
}));

const strings: QuickAddStrings = {
  addToBag: 'Add to bag',
  addToBagLabel: 'Add {name} to bag',
  chooseOptions: 'Choose options for {name}',
  closeOptions: 'Close options',
  soldOut: 'Sold out',
  chooseOption: 'Choose a {option}',
  selected: '{option}: {value}',
  valueSoldOut: '{value}, sold out',
  optionLabels: { size: 'Size', color: 'Colour' },
  added: 'Added to your bag: {name}',
  addedQuantity: 'Added to your bag: {name} ({count})',
  capped: 'You can add up to {max} of this piece',
  full: 'Your bag is full',
  viewBag: 'View bag',
};

/** A product with no options: one press adds. */
function simple(): QuickAddModel {
  return {
    slug: 'leather-tote',
    name: { text: 'Leather tote', lang: 'en' },
    imageUrl: null,
    price: 2400,
    inStock: true,
    options: [],
    variants: [],
  };
}

/** A product needing a size, with M sold out. */
function sized(): QuickAddModel {
  return {
    slug: 'silk-midi-dress',
    name: { text: 'Silk midi dress', lang: 'en' },
    imageUrl: null,
    price: 2850,
    inStock: true,
    options: [{ key: 'size', label: 'Size', values: ['S', 'M'] }],
    variants: [
      { options: { size: 'S' }, price: 2850, inStock: true },
      { options: { size: 'M' }, price: 2850, inStock: false },
    ],
  };
}

function soldOut(): QuickAddModel {
  return {
    ...sized(),
    inStock: false,
    variants: sized().variants.map((v) => ({ ...v, inStock: false })),
  };
}

beforeEach(() => add.mockClear());
afterEach(cleanup);

describe('QuickAdd', () => {
  it('adds on one press when nothing needs choosing', () => {
    render(<QuickAdd product={simple()} strings={strings} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Leather tote to bag' }));

    expect(add).toHaveBeenCalledOnce();
    expect(add.mock.calls[0]![0]).toMatchObject({ slug: 'leather-tote', options: {} });
  });

  /** The reason Quick Add exists: a piece that needs a size is never given one silently. */
  it('opens the panel instead of adding when a choice is missing', () => {
    render(<QuickAdd product={sized()} strings={strings} />);
    const trigger = screen.getByRole('button', { name: 'Choose options for Silk midi dress' });

    fireEvent.click(trigger);

    expect(add).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Choose options for Silk midi dress' })).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('moves focus to the unanswered group rather than only saying so', async () => {
    render(<QuickAdd product={sized()} strings={strings} />);

    fireEvent.click(screen.getByRole('button', { name: 'Choose options for Silk midi dress' }));

    // The component waits a frame so the panel it just opened exists to focus into.
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole('radio')[0]));
  });

  it('adds only after a value is chosen, carrying that value', () => {
    render(<QuickAdd product={sized()} strings={strings} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose options for Silk midi dress' }));
    expect(add).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: 'S' }));
    // Two controls carry this name once the panel is open — the disc and the panel's own
    // worded button. Pressing the panel's is what a shopper who opened it would do.
    const [, panelAdd] = screen.getAllByRole('button', { name: 'Add Silk midi dress to bag' });
    fireEvent.click(panelAdd!);

    expect(add).toHaveBeenCalledOnce();
    expect(add.mock.calls[0]![0]).toMatchObject({ options: { size: 'S' } });
  });

  it('closes on Escape and returns focus to the trigger', () => {
    render(<QuickAdd product={sized()} strings={strings} />);
    const trigger = screen.getByRole('button', { name: 'Choose options for Silk midi dress' });
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on an outside pointer press', () => {
    render(
      <div>
        <button type="button">elsewhere</button>
        <QuickAdd product={sized()} strings={strings} />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Choose options for Silk midi dress' }));

    fireEvent.pointerDown(screen.getByRole('button', { name: 'elsewhere' }));

    expect(screen.queryByRole('group')).toBeNull();
  });

  /**
   * Availability is never colour alone, and a sold-out control stays reachable: it is
   * `aria-disabled`, not `disabled`, so a keyboard user can find it and be told why.
   */
  it('keeps a sold-out disc focusable and inert', () => {
    render(<QuickAdd product={soldOut()} strings={strings} />);
    const trigger = screen.getByRole('button', { name: 'Sold out' });

    expect(trigger.getAttribute('aria-disabled')).toBe('true');
    expect(trigger.hasAttribute('disabled')).toBe(false);

    fireEvent.click(trigger);
    expect(add).not.toHaveBeenCalled();
  });

  it('marks a sold-out value in text, not by colour alone', () => {
    render(<QuickAdd product={sized()} strings={strings} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose options for Silk midi dress' }));

    expect(screen.getByRole('radio', { name: 'M, sold out' })).toBeTruthy();
  });
});
