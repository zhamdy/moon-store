import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport/index';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import type { Coupon } from '../types';
import Promotions from './Promotions';

const SUMMER: Coupon = {
  id: 1,
  code: 'SUMMER20',
  type: 'percentage',
  value: 20,
  min_purchase: null,
  max_discount: null,
  starts_at: null,
  expires_at: null,
  max_uses: null,
  max_uses_per_customer: null,
  scope: 'all',
  scope_ids: null,
  stackable: 0,
  status: 'active',
  usage_count: 3,
  created_at: '2026-01-01',
};

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

describe('Promotions', () => {
  // The page renders whichever locale is set; pin it so assertions read in one.
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('shows the coupons the server holds', async () => {
    const transport = createMemoryTransport({ coupons: [SUMMER] });

    render(<Promotions />, { wrapper: wrapperFor(transport) });

    expect(await screen.findByText('SUMMER20')).toBeInTheDocument();
    expect(transport.calls()).toContainEqual(
      expect.objectContaining({ method: 'GET', path: 'coupons' })
    );
  });

  it('creates a coupon from the editor dialog', async () => {
    const transport = createMemoryTransport({ coupons: [SUMMER] });

    render(<Promotions />, { wrapper: wrapperFor(transport) });
    await screen.findByText('SUMMER20');

    fireEvent.click(screen.getByRole('button', { name: /Add Coupon/i }));

    fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'WINTER10' } });
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '10' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);

    await waitFor(() => expect(transport.peek('coupons')).toHaveLength(2));
    expect(transport.calls()).toContainEqual(
      expect.objectContaining({
        method: 'POST',
        path: 'coupons',
        body: expect.objectContaining({ code: 'WINTER10', value: 10 }),
      })
    );
    // The new row arrives without the page asking for a refetch.
    expect(await screen.findByText('WINTER10')).toBeInTheDocument();
  });

  it('sends the search box straight to the server rather than filtering locally', async () => {
    const transport = createMemoryTransport({ coupons: [SUMMER] });

    render(<Promotions />, { wrapper: wrapperFor(transport) });
    await screen.findByText('SUMMER20');

    fireEvent.change(screen.getByPlaceholderText(/Search coupons/i), {
      target: { value: 'WINTER' },
    });

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'GET',
          path: 'coupons',
          params: { page: 1, pageSize: 25, search: 'WINTER' },
        })
      )
    );
  });
});
