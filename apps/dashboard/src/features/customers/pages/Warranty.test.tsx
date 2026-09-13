import { beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import WarrantyPage from './Warranty';

function wrapperFor(transport: MemoryTransport) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

const claim = (over: Record<string, unknown> = {}) => ({
  id: 1,
  sale_id: null,
  product_id: 7,
  product_name: 'Printed Silk Scarf',
  customer_name: 'Sara',
  customer_phone: '01000000000',
  issue_description: 'Zipper broken',
  status: 'pending',
  resolution: null,
  created_at: '2026-09-01T00:00:00.000Z',
  ...over,
});

/**
 * These assert the wire shape, not the rendering. The page was unreachable for
 * long enough to drift from the server it talks to in three ways that all
 * typechecked cleanly: a POST missing every required customer field, a PUT to
 * a `:id/status` sub-route that does not exist, and a status vocabulary the
 * database's CHECK constraint rejects outright.
 */
describe('Warranty claims wire contract', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('posts the fields the server validator requires, and omits an unfilled sale', async () => {
    const transport = createMemoryTransport({ warranty: [] });
    render(<WarrantyPage />, { wrapper: wrapperFor(transport) });

    fireEvent.click(await screen.findByRole('button', { name: 'New Claim' }));
    fireEvent.change(await screen.findByLabelText(/Customer Name/), {
      target: { value: 'Mona' },
    });
    fireEvent.change(screen.getByLabelText(/Customer Phone/), {
      target: { value: '01099887766' },
    });
    fireEvent.change(screen.getByLabelText(/Product ID/), { target: { value: '31' } });
    fireEvent.change(screen.getByLabelText(/Issue Description/), {
      target: { value: 'Seam came apart' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: 'warranty',
          body: {
            customer_name: 'Mona',
            customer_phone: '01099887766',
            product_id: 31,
            sale_id: undefined,
            issue_description: 'Seam came apart',
          },
        })
      )
    );
  });

  it('changes status by PUTting the record, not a :id/status sub-route', async () => {
    const transport = createMemoryTransport({ warranty: [claim()] });
    render(<WarrantyPage />, { wrapper: wrapperFor(transport) });

    const select = await screen.findByRole('combobox', { name: 'Change claim status' });
    fireEvent.change(select, { target: { value: 'approved' } });

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'PUT',
          path: 'warranty/1',
          body: { status: 'approved' },
        })
      )
    );
    expect(transport.calls().some((call) => call.path.endsWith('/status'))).toBe(false);
  });

  it('offers only transitions the database CHECK constraint accepts', async () => {
    const transport = createMemoryTransport({ warranty: [claim()] });
    render(<WarrantyPage />, { wrapper: wrapperFor(transport) });

    const select = await screen.findByRole('combobox', { name: 'Change claim status' });
    expect([...select.querySelectorAll('option')].map((o) => o.getAttribute('value'))).toEqual([
      'pending',
      'approved',
      'rejected',
    ]);
  });

  it('locks the selector on a claim that has reached a terminal outcome', async () => {
    const transport = createMemoryTransport({ warranty: [claim({ status: 'refunded' })] });
    render(<WarrantyPage />, { wrapper: wrapperFor(transport) });

    const select = await screen.findByRole('combobox', { name: 'Change claim status' });
    expect(select).toBeDisabled();
    expect(screen.getAllByText('Refunded').length).toBeGreaterThan(0);
  });

  it('translates every status the database can hold, including the server default', async () => {
    const statuses = [
      'pending',
      'approved',
      'rejected',
      'completed',
      'resolved',
      'replaced',
      'refunded',
    ];
    const transport = createMemoryTransport({
      warranty: statuses.map((status, i) => claim({ id: i + 1, status })),
    });
    render(<WarrantyPage />, { wrapper: wrapperFor(transport) });

    await waitFor(() => expect(screen.getAllByText('Pending').length).toBeGreaterThan(0));
    for (const label of ['Approved', 'Rejected', 'Completed', 'Resolved', 'Replaced', 'Refunded']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    // A raw, untranslated status value must never reach the badge.
    for (const status of statuses) {
      expect(screen.queryByText(status)).toBeNull();
    }
  });

  it('renders a claim with no linked sale rather than an empty reference', async () => {
    const transport = createMemoryTransport({ warranty: [claim()] });
    render(<WarrantyPage />, { wrapper: wrapperFor(transport) });

    await screen.findByText('Printed Silk Scarf');
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
