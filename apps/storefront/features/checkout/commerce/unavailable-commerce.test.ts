import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkoutCommerce } from '.';
import type { CheckoutSubmission } from './checkout-commerce';

const SUBMISSION: CheckoutSubmission = {
  contact: { fullName: 'Nour Hassan', phone: '01001112233', email: null },
  address: {
    governorate: 'Cairo',
    area: 'Zamalek',
    street: 'Street 1',
    apartment: null,
    landmark: null,
  },
  deliveryMethod: null,
  cart: {
    quoteKey: 'q',
    lines: [{ slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 1 }],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('phase 1 commerce', () => {
  it('resolves unavailable and makes no network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(checkoutCommerce.submit(SUBMISSION)).resolves.toEqual({ kind: 'unavailable' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
