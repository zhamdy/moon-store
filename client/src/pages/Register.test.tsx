import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../shared/lib/transport/index';
import { createMemoryTransport, type MemoryTransport } from '../shared/lib/transport/memory';
import { useSettingsStore } from '../shared/store/settingsStore';
import type { RegisterReportData, RegisterSession } from '@/types';
import RegisterPage from './Register';

const OPEN_SESSION: RegisterSession = {
  id: 12,
  cashier_id: 2,
  cashier_name: 'Sarah',
  opened_at: '2026-03-01T08:00:00Z',
  closed_at: null,
  opening_float: 200,
  expected_cash: 640,
  counted_cash: null,
  variance: null,
  status: 'open',
  notes: null,
  sale_count: 6,
  total_in: 500,
  total_out: 60,
};

const REPORT: RegisterReportData = {
  session: OPEN_SESSION,
  movements: [],
  summary: {
    total_sales: 500,
    total_refunds: 0,
    total_cash_in: 40,
    total_cash_out: 60,
    sale_count: 6,
    refund_count: 0,
  },
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

describe('Register', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('opens the drawer with the float that was counted into it', async () => {
    // No session yet, so the page offers to open one.
    const transport = createMemoryTransport({}, { reads: { 'register/current': null } });

    render(<RegisterPage />, { wrapper: wrapperFor(transport) });
    await screen.findByText('No open register session');

    fireEvent.click(screen.getAllByRole('button', { name: /Open Register/i })[0]);
    fireEvent.change(await screen.findByRole('spinbutton'), { target: { value: '250' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);

    await waitFor(() =>
      expect(transport.calls()).toContainEqual({
        method: 'POST',
        path: 'register/open',
        body: { opening_float: 250 },
      })
    );
  });

  it('records a cash movement against the open drawer', async () => {
    const transport = createMemoryTransport({}, { reads: { 'register/current': OPEN_SESSION } });

    render(<RegisterPage />, { wrapper: wrapperFor(transport) });
    await screen.findByText('Cash In');

    fireEvent.click(screen.getByRole('button', { name: /Cash In/i }));
    fireEvent.change(await screen.findByRole('spinbutton'), { target: { value: '40' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: 'register/movement',
          body: expect.objectContaining({ type: 'cash_in', amount: 40 }),
        })
      )
    );
  });

  it('closes the drawer with the counted cash, then reads the session report', async () => {
    const transport = createMemoryTransport(
      {},
      { reads: { 'register/current': OPEN_SESSION, 'register/12/report': REPORT } }
    );

    render(<RegisterPage />, { wrapper: wrapperFor(transport) });
    await screen.findByText('Cash In');

    fireEvent.click(screen.getByRole('button', { name: /Close Register/i }));
    fireEvent.change(await screen.findByRole('spinbutton'), { target: { value: '615' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);

    await waitFor(() =>
      expect(transport.calls()).toContainEqual({
        method: 'POST',
        path: 'register/close',
        body: { counted_cash: 615, notes: undefined },
      })
    );

    // The in-memory transport models CRUD only, so `register/close` fails there
    // and the dialog stays up; dismiss it to get back to the page underneath.
    fireEvent.keyDown(document.body, { key: 'Escape' });

    // The report is a read hanging off the session, taken when it is asked for.
    fireEvent.click(await screen.findByRole('button', { name: /X-Report/i }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({ method: 'GET', path: 'register/12/report' })
      )
    );
    expect(await screen.findByText('Sarah', { exact: false })).toBeInTheDocument();
  });
});
