import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '../../../shared/tests/routerTestUtils';
import { TransportProvider } from '../../../shared/lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import Segments from './Segments';

const summary = [
  { segment: 'champions', count: 2, total_revenue: 9000, avg_frequency: 8 },
  { segment: 'loyal', count: 1, total_revenue: 3000, avg_frequency: 5 },
  { segment: 'potential', count: 0, total_revenue: 0, avg_frequency: 0 },
  { segment: 'at_risk', count: 0, total_revenue: 0, avg_frequency: 0 },
  { segment: 'hibernating', count: 0, total_revenue: 0, avg_frequency: 0 },
  { segment: 'lost', count: 1, total_revenue: 250, avg_frequency: 1 },
  { segment: 'new', count: 0, total_revenue: 0, avg_frequency: 0 },
];

const customers = [
  {
    id: 1,
    name: 'Nadia Kamal',
    phone: '01000000001',
    email: null,
    recency_days: 3,
    frequency: 9,
    monetary: 6000,
    segment: 'champions',
    loyalty_points: 120,
  },
];

function renderSegments(body: unknown = { customers, summary }, initialRoute = '/') {
  const transport: MemoryTransport = createMemoryTransport(
    {},
    { reads: { 'analytics/customer-segments': body } }
  );
  const result = renderWithRouter(
    <TransportProvider transport={transport}>
      <Segments />
    </TransportProvider>,
    { initialRoute }
  );
  return { transport, ...result };
}

describe('Segments page', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('reads the RFM endpoint, not the rule-authored segments collection', async () => {
    const { transport } = renderSegments();
    await screen.findByRole('heading', { name: 'Customer Segments' });

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'GET',
          path: 'analytics/customer-segments',
          params: expect.objectContaining({ page: '1', pageSize: '25' }),
        })
      )
    );
    expect(transport.calls().some((call) => call.path === 'segments')).toBe(false);
  });

  it('renders every segment as a toggle, including the ones nobody is in', async () => {
    renderSegments();

    const champions = await screen.findByRole('button', { name: /Champions/ });
    expect(champions).toHaveAttribute('aria-pressed', 'false');
    expect(await screen.findByRole('button', { name: /Potential Loyalists/ })).toBeInTheDocument();
    expect(await screen.findByText('Nadia Kamal')).toBeInTheDocument();
  });

  it('asks the server for one segment when a tile is pressed', async () => {
    const { transport } = renderSegments();
    const champions = await screen.findByRole('button', { name: /Champions/ });

    fireEvent.click(champions);

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          path: 'analytics/customer-segments',
          params: expect.objectContaining({ segment: 'champions', page: '1' }),
        })
      )
    );
    await waitFor(() =>
      // Re-queried: the tile is re-rendered by the navigation, so the node held
      // from before the click is no longer the one on screen.
      expect(screen.getByRole('button', { name: /Champions/ })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    );
  });

  it('takes the selected segment from the URL, so the view is shareable', async () => {
    const { transport } = renderSegments({ customers: [], summary }, '/?segment=lost');

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          path: 'analytics/customer-segments',
          params: expect.objectContaining({ segment: 'lost' }),
        })
      )
    );
    expect(await screen.findByRole('button', { name: /^Lost/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('survives a response with no summary rather than blanking the page', async () => {
    // What the page did against `GET /segments`, which answers with an array of
    // rule-authored segments and no `summary` at all.
    renderSegments([{ id: 1, name: 'VIP' }]);

    expect(await screen.findByRole('heading', { name: 'Customer Segments' })).toBeInTheDocument();
  });
});
