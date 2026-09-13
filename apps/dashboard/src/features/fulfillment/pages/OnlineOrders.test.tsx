import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport/index';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import { useAuthStore } from '../../auth';
import type { OnlineOrder } from '../types';
import OnlineOrdersPage from './OnlineOrders';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

const PENDING_ORDER: OnlineOrder = {
  id: 1,
  order_number: 'WEB-20260101-1000',
  customer_name: 'Nadia Fathy',
  status: 'pending',
  payment_status: 'paid',
  total: 450,
  shipping_method: 'standard',
  tracking_number: null,
  created_at: '2026-01-01T09:00:00Z',
  items: [{ id: 1, product_name: 'Silk Scarf', quantity: 1, unit_price: 450, total: 450 }],
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

describe('OnlineOrdersPage', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useAuthStore.setState({
      user: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
      accessToken: 'token',
      isAuthenticated: true,
    });
  });

  it('never offers "confirmed" as a status filter -- the server does not have that status', async () => {
    const transport = createMemoryTransport({ 'online-orders': [PENDING_ORDER] });
    render(<OnlineOrdersPage />, { wrapper: wrapperFor(transport) });

    // The order number cell renders "#" and the number as sibling text nodes.
    await screen.findByText('#WEB-20260101-1000');
    expect(screen.queryByRole('button', { name: 'Confirmed' })).not.toBeInTheDocument();
  });

  /**
   * The server's `onlineOrderStatusSchema` only ever admitted
   * pending/processing/shipped/delivered/cancelled -- 'confirmed' was a client-only
   * status that always 400'd. Confirming a pending order must move it to 'processing',
   * the real status the server uses for the same transition (and the one that turns
   * the stock hold into a deduction).
   */
  it('sends "processing", not "confirmed", when an admin confirms a pending order', async () => {
    const transport = createMemoryTransport({ 'online-orders': [PENDING_ORDER] });
    render(<OnlineOrdersPage />, { wrapper: wrapperFor(transport) });

    // The order number cell renders "#" and the number as sibling text nodes.
    await screen.findByText('#WEB-20260101-1000');
    fireEvent.click(screen.getByRole('button', { name: 'View order' }));

    const confirmButton = await screen.findByRole('button', { name: 'Confirm' });
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(transport.calls()).toContainEqual({
        method: 'PUT',
        path: 'online-orders/1/status',
        body: { status: 'processing' },
      })
    );
  });
});
