import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport/index';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import { useAuthStore } from '../../auth';
import type { Shift } from '../types';
import ShiftsPage from './Shifts';

const ACTIVE_SHIFT: Shift = {
  id: 4,
  user_id: 2,
  user_name: 'Sarah',
  role: 'Cashier',
  clock_in: '2026-03-01T08:00:00Z',
  clock_out: null,
  status: 'active',
  total_hours: null,
  break_minutes: 0,
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

describe('Shifts', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useAuthStore.setState({
      user: { id: 2, name: 'Sarah', email: 'sarah@moon.com', role: 'Cashier' },
      accessToken: 'token',
      isAuthenticated: true,
    });
  });

  it('clocks in when nobody is on shift', async () => {
    const transport = createMemoryTransport({}, { reads: { 'shifts/current': null } });

    render(<ShiftsPage />, { wrapper: wrapperFor(transport) });
    const button = await screen.findByRole('button', { name: /Clock In/i });

    fireEvent.click(button);

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({ method: 'POST', path: 'shifts/clock-in' })
      )
    );
  });

  it('starts a break on the shift already running', async () => {
    const transport = createMemoryTransport({}, { reads: { 'shifts/current': ACTIVE_SHIFT } });

    render(<ShiftsPage />, { wrapper: wrapperFor(transport) });
    const button = await screen.findByRole('button', { name: /Start Break/i });

    fireEvent.click(button);

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({ method: 'POST', path: 'shifts/break/start' })
      )
    );
  });

  it('reads the admin tabs off the shifts collection, one tab at a time', async () => {
    useAuthStore.setState({
      user: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
      accessToken: 'token',
      isAuthenticated: true,
    });
    const transport = createMemoryTransport(
      { shifts: [ACTIVE_SHIFT] },
      { reads: { 'shifts/current': null } }
    );

    render(<ShiftsPage />, { wrapper: wrapperFor(transport) });
    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'GET',
          path: 'shifts',
          params: expect.objectContaining({ status: 'open', page: 1, pageSize: 25 }),
        })
      )
    );

    expect(screen.queryByRole('tab', { name: 'Timesheet' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Shift History' }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'GET',
          path: 'shifts',
          params: expect.objectContaining({ status: 'completed', page: 1, pageSize: 25 }),
        })
      )
    );
  });
});
