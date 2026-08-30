import { describe, it, expect, beforeEach } from 'vitest';
import { useHeldCartsStore, type HeldCartV0 } from './heldCartsStore';
import type { CartItem } from './cartStore';

const DRESS: CartItem = {
  product_id: 1,
  variant_id: 101,
  name: 'Silk Dress (Red / M)',
  unit_price: 500,
  quantity: 2,
  stock: 10,
};

beforeEach(() => {
  useHeldCartsStore.setState({ carts: [] });
});

describe('HeldCartsStore - holdCart', () => {
  it('stores notes/tip/couponCode when provided', () => {
    useHeldCartsStore
      .getState()
      .holdCart('Lunch break', [DRESS], 10, 'fixed', { notes: 'VIP', tip: 5, couponCode: 'X' });

    const [cart] = useHeldCartsStore.getState().carts;
    expect(cart.notes).toBe('VIP');
    expect(cart.tip).toBe(5);
    expect(cart.couponCode).toBe('X');
  });

  it('defaults notes/tip/couponCode to empty when extras are omitted', () => {
    useHeldCartsStore.getState().holdCart('Lunch break', [DRESS], 10, 'fixed');

    const [cart] = useHeldCartsStore.getState().carts;
    expect(cart.notes).toBe('');
    expect(cart.tip).toBe(0);
    expect(cart.couponCode).toBe('');
  });
});

describe('HeldCartsStore - retrieveCart is non-destructive', () => {
  it('does not remove the cart from storage', () => {
    useHeldCartsStore.getState().holdCart('Lunch break', [DRESS], 10, 'fixed');
    const id = useHeldCartsStore.getState().carts[0].id;

    const found = useHeldCartsStore.getState().retrieveCart(id);

    expect(found).toBeDefined();
    // Still present -- only `deleteCart` removes it, and only the caller
    // decides when the transfer has actually succeeded.
    expect(useHeldCartsStore.getState().carts).toHaveLength(1);
  });

  it('deleteCart removes it', () => {
    useHeldCartsStore.getState().holdCart('Lunch break', [DRESS], 10, 'fixed');
    const id = useHeldCartsStore.getState().carts[0].id;

    useHeldCartsStore.getState().deleteCart(id);

    expect(useHeldCartsStore.getState().carts).toHaveLength(0);
  });

  it('preserves variant identity and quantity on retrieval', () => {
    useHeldCartsStore.getState().holdCart('Lunch break', [DRESS], 10, 'fixed');
    const id = useHeldCartsStore.getState().carts[0].id;

    const found = useHeldCartsStore.getState().retrieveCart(id);

    expect(found?.items[0].variant_id).toBe(101);
    expect(found?.items[0].quantity).toBe(2);
    expect(found?.discountType).toBe('fixed');
    expect(found?.discount).toBe(10);
  });
});

describe('HeldCartsStore persisted-state migration (v0 -> v1)', () => {
  const migrate = useHeldCartsStore.persist.getOptions().migrate as (
    persisted: unknown,
    version: number
  ) => { carts: ReturnType<typeof useHeldCartsStore.getState>['carts'] };

  /**
   * CHARACTERIZATION: literal example of the exact JSON persisted at
   * `moon-held-carts` before this migration existed -- held carts never
   * stored `notes`/`tip`/`couponCode` at all, and there was no `version`
   * key. Taken from the pre-Unit-6 `HeldCart` interface in this file's git
   * history, not guessed.
   */
  const V0_FIXTURE: { carts: HeldCartV0[] } = {
    carts: [
      {
        id: '1700000000000',
        name: 'Cart #1',
        items: [
          {
            product_id: 1,
            variant_id: 101,
            name: 'Silk Dress (Red / M)',
            unit_price: 500,
            quantity: 2,
            stock: 10,
          },
        ],
        discount: 15,
        discountType: 'percentage',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };

  it('initializes notes/tip/couponCode to empty defaults for a legacy held cart', () => {
    const migrated = migrate(V0_FIXTURE, 0);

    expect(migrated.carts).toHaveLength(1);
    const [cart] = migrated.carts;
    expect(cart.items).toEqual(V0_FIXTURE.carts[0].items);
    expect(cart.discount).toBe(15);
    expect(cart.discountType).toBe('percentage');
    expect(cart.notes).toBe('');
    expect(cart.tip).toBe(0);
    expect(cart.couponCode).toBe('');
  });

  it('sanitizes a corrupt item within a held cart without dropping the cart', () => {
    const corrupt = {
      carts: [
        {
          id: '1',
          name: 'Cart #1',
          items: [
            { product_id: 1, unit_price: 500, quantity: 2, stock: 10, name: 'Valid' },
            { product_id: 2, unit_price: Number.NaN, quantity: 1, stock: 5, name: 'Bad' },
          ],
          discount: Number.NaN,
          discountType: 'unknown-type',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const migrated = migrate(corrupt, 0);

    expect(migrated.carts[0].items).toHaveLength(1);
    expect(migrated.carts[0].items[0].name).toBe('Valid');
    expect(migrated.carts[0].discount).toBe(0);
    expect(migrated.carts[0].discountType).toBe('fixed');
  });

  it('drops an unrecoverable entry (no id/name) rather than the whole queue', () => {
    const mixed = {
      carts: [{ notAHeldCart: true }, V0_FIXTURE.carts[0]],
    };

    const migrated = migrate(mixed, 0);

    expect(migrated.carts).toHaveLength(1);
    expect(migrated.carts[0].id).toBe('1700000000000');
  });
});
