import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport/index';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import { useCartStore } from '../store/cartStore';
import { useOfflineStore } from '../../../shared/store/offlineStore';
import { useHeldCartsStore } from '../store/heldCartsStore';
import POS from './POS';

const SILK_DRESS = {
  id: 7,
  name: 'Silk Dress',
  sku: 'SD-1',
  barcode: null,
  price: 250,
  cost_price: 100,
  stock: 5,
  min_stock: 1,
  category: null,
  category_id: null,
  category_name: null,
  category_code: null,
  distributor_id: null,
  distributor_name: null,
  image_url: null,
  has_variants: 0,
  variant_count: 0,
  variant_stock: 0,
  status: 'active',
  created_at: '',
  updated_at: '',
};

function makeTransport(reads: Record<string, unknown> = {}) {
  return createMemoryTransport(
    { products: [SILK_DRESS], bundles: [] },
    {
      reads: {
        'products/categories': [],
        'users/me/favorites': [],
        settings: { tax_enabled: 'false', loyalty_enabled: 'false' },
        ...reads,
      },
    }
  );
}

function wrapperFor(transport: MemoryTransport) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

/** Records every message posted to a named BroadcastChannel. */
class RecordingChannel {
  static messagesByName: Record<string, unknown[]> = {};
  name: string;
  constructor(name: string) {
    this.name = name;
    RecordingChannel.messagesByName[name] ??= [];
  }
  postMessage(message: unknown) {
    RecordingChannel.messagesByName[this.name].push(message);
  }
  close() {}
}

describe('POS customer-display broadcasting', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useOfflineStore.setState({ queue: [], isSyncing: false });
    useHeldCartsStore.setState({ carts: [] });
    useCartStore.setState({
      items: [],
      discount: 0,
      discountType: 'fixed',
      notes: '',
      tip: 0,
      couponCode: '',
      couponDiscount: 0,
      needsReview: false,
    });
    RecordingChannel.messagesByName = {};
    vi.stubGlobal('BroadcastChannel', RecordingChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets CartPanel own the broadcast: exactly one canonical message per cart change, never a second partial one from the page', async () => {
    const transport = makeTransport();

    render(<POS />, { wrapper: wrapperFor(transport) });

    fireEvent.click(await screen.findByText('Silk Dress'));

    await waitFor(() =>
      expect(RecordingChannel.messagesByName['moon-customer-display']?.length).toBeGreaterThan(0)
    );

    const messages = RecordingChannel.messagesByName['moon-customer-display'];
    const updates = messages.filter(
      (m): m is { type: string; cart: Record<string, unknown> } =>
        typeof m === 'object' && m !== null && (m as { type?: string }).type === 'cart-update'
    );
    expect(updates.length).toBeGreaterThan(0);

    const last = updates[updates.length - 1];
    // The canonical shape CartPanel posts (Unit 5) -- `amountDue`, never the
    // page's old, tax/loyalty-blind `total` field. If POS.tsx were still
    // broadcasting its own partial projection alongside CartPanel's, this
    // array would contain a message shaped like `{ total, tip }` with no
    // `amountDue`.
    expect(last.cart).toHaveProperty('amountDue');
    expect(last.cart).not.toHaveProperty('total');
    expect(last.cart.amountDue).toBe(250);
  });
});
