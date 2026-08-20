import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport/index';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import { useAuthStore } from '../../auth';
import type { DeliveryOrder, DeliveryPerformance } from '../types';
import Deliveries from './Deliveries';

const PENDING_ORDER: DeliveryOrder = {
  id: 7,
  order_number: 'DEL-0007',
  customer_name: 'Layla Hassan',
  phone: '0500000000',
  address: '12 Olive Street',
  notes: null,
  status: 'Pending',
  shipping_company_id: null,
  shipping_company_name: null,
  tracking_number: null,
  shipping_cost: 0,
  estimated_delivery: null,
  created_at: '2026-01-01T09:00:00Z',
  updated_at: '2026-01-01T09:00:00Z',
};

const PERFORMANCE: DeliveryPerformance = {
  totalDelivered: 4,
  avgDeliveryDays: 2,
  pendingCount: 1,
  shippedCount: 0,
  companyStats: [],
};

function transportWithOrders() {
  return createMemoryTransport(
    { delivery: [PENDING_ORDER] },
    { reads: { 'delivery/analytics/performance': PERFORMANCE } }
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

/** Opens a closed Radix select and returns its options. */
function openSelect(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  return screen.getAllByRole('option');
}

describe('Deliveries', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useAuthStore.setState({
      user: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
      accessToken: 'token',
      isAuthenticated: true,
    });
  });

  it('lists the orders the server holds, filtered server-side', async () => {
    const transport = transportWithOrders();

    render(<Deliveries />, { wrapper: wrapperFor(transport) });

    expect(await screen.findByText('DEL-0007')).toBeInTheDocument();
    expect(transport.calls()).toContainEqual(
      expect.objectContaining({
        method: 'GET',
        path: 'delivery',
        params: { limit: 100, status: undefined },
      })
    );
  });

  it('sends a status transition to the endpoint that notifies the customer', async () => {
    const transport = transportWithOrders();

    render(<Deliveries />, { wrapper: wrapperFor(transport) });
    await screen.findByText('DEL-0007');

    // The row's status select, as opposed to the table's rows-per-page one.
    const statusTrigger = screen
      .getAllByRole('combobox')
      .find((el) => el.textContent?.includes('Pending'));
    expect(statusTrigger).toBeDefined();

    const shipped = openSelect(statusTrigger as HTMLElement).find(
      (option) => option.textContent === 'Shipped'
    );
    fireEvent.click(shipped as HTMLElement);

    // Byte-for-byte what the axios call used to send: the same verb, the same
    // path, and a body of nothing but the new status. The SMS and WhatsApp
    // notifications hang off this endpoint on the server.
    await waitFor(() =>
      expect(transport.calls()).toContainEqual({
        method: 'PUT',
        path: 'delivery/7/status',
        body: { status: 'Shipped' },
      })
    );

    // The list refreshes itself off the back of the write, without the page
    // naming anything to invalidate.
    await waitFor(() =>
      expect(
        transport.calls().filter((call) => call.method === 'GET' && call.path === 'delivery')
      ).toHaveLength(2)
    );
  });

  it('reads delivery performance off the same collection as the orders', async () => {
    const transport = transportWithOrders();

    render(<Deliveries />, { wrapper: wrapperFor(transport) });

    expect(await screen.findByText('DEL-0007')).toBeInTheDocument();
    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({ method: 'GET', path: 'delivery/analytics/performance' })
      )
    );
  });
});
