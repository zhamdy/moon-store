import { beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import Settings from './Settings';

function wrapperFor(transport: MemoryTransport) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

describe('Settings page - canonical loyalty units', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('hydrates loyalty inputs from canonical setting keys, not legacy aliases', async () => {
    const transport = createMemoryTransport(
      {},
      {
        reads: {
          settings: {
            loyalty_enabled: 'true',
            loyalty_points_per_egp: '2',
            loyalty_egp_per_point: '0.1',
            // A not-yet-migrated database could still return these; the UI
            // must ignore them once canonical keys are present.
            loyalty_earn_rate: '999',
            loyalty_redeem_value: '999',
          },
        },
      }
    );

    render(<Settings />, { wrapper: wrapperFor(transport) });

    expect(await screen.findByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.1')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('999')).not.toBeInTheDocument();
  });

  it('saves the canonical loyalty keys, never the legacy alias names', async () => {
    const transport = createMemoryTransport({}, { reads: { settings: {} } });
    render(<Settings />, { wrapper: wrapperFor(transport) });

    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'PUT',
          path: 'settings',
          body: expect.objectContaining({
            loyalty_points_per_egp: '1',
            loyalty_egp_per_point: '0.1',
          }),
        })
      )
    );

    const saveCall = transport
      .calls()
      .find((call) => call.method === 'PUT' && call.path === 'settings');
    expect(saveCall?.body).not.toHaveProperty('loyalty_earn_rate');
    expect(saveCall?.body).not.toHaveProperty('loyalty_redeem_value');
  });

  it('labels the earn/redeem inputs with unambiguous, non-reciprocal units in English', async () => {
    const transport = createMemoryTransport(
      {},
      { reads: { settings: { loyalty_enabled: 'true' } } }
    );
    render(<Settings />, { wrapper: wrapperFor(transport) });

    expect(await screen.findByText('Points earned per 1 EGP spent')).toBeInTheDocument();
    expect(screen.getByText('Redemption value (EGP per point)')).toBeInTheDocument();
    // The historical label implied a reciprocal "per 100 points" unit; it
    // must not reappear.
    expect(screen.queryByText(/per 100 points/i)).not.toBeInTheDocument();
  });

  it('labels the earn/redeem inputs with unambiguous units in Arabic', async () => {
    useSettingsStore.setState({ locale: 'ar' });
    const transport = createMemoryTransport(
      {},
      { reads: { settings: { loyalty_enabled: 'true' } } }
    );
    render(<Settings />, { wrapper: wrapperFor(transport) });

    expect(await screen.findByText('نقاط مكتسبة لكل 1 جنيه مصروف')).toBeInTheDocument();
    expect(screen.getByText('قيمة الاستبدال (جنيه لكل نقطة)')).toBeInTheDocument();
  });
});
