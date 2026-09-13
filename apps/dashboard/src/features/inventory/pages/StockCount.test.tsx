/**
 * The three stock-count actions the page called against routes the server never served
 * (#172): a per-item approve, a whole-count "approve" and a DELETE cancel. The server only
 * ever served `POST /:id/complete` and `POST /:id/cancel`, so every one of those clicks
 * was a dead call. This pins the page to the routes that actually exist.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport/index';
import { createMemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import { useAuthStore } from '../../auth';
import { renderWithRouter } from '../../../shared/tests/routerTestUtils';
import type { StockCountDetail } from '../types';
import StockCountPage from './StockCount';

const DETAIL: StockCountDetail = {
  id: 7,
  status: 'in_progress',
  category_name: 'Dresses',
  notes: null,
  started_by_name: 'Sarah',
  started_at: '2026-03-01T08:00:00Z',
  item_count: 1,
  counted: 0,
  items: [
    {
      id: 101,
      product_id: 1,
      product_name: 'Silk Dress',
      product_sku: 'DRS-001',
      expected_qty: 10,
      actual_qty: null,
      approved: 0,
    },
  ],
};

describe('StockCount detail actions', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useAuthStore.setState({
      user: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
      accessToken: 'token',
      isAuthenticated: true,
    });
  });

  function renderDetail() {
    const transport = createMemoryTransport({ 'stock-counts': [DETAIL] });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    renderWithRouter(
      <TransportProvider transport={transport}>
        <StockCountPage />
      </TransportProvider>,
      {
        queryClient,
        initialRoute: '/stock-counts',
        authState: {
          isAuthenticated: true,
          user: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
        },
      }
    );
    return transport;
  }

  it('does not offer a per-item approve control -- there is no such concept server-side', async () => {
    const transport = renderDetail();
    fireEvent.click(await screen.findByText(/Stock Count #7/));
    await screen.findByText('Silk Dress');

    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
    expect(transport.calls()).not.toContainEqual(
      expect.objectContaining({ path: expect.stringContaining('/approve') })
    );
  });

  it('sends "Approve & Apply" to the real complete endpoint, not the dead /approve route', async () => {
    const transport = renderDetail();
    fireEvent.click(await screen.findByText(/Stock Count #7/));
    fireEvent.click(await screen.findByRole('button', { name: /Approve & Apply/i }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({ method: 'POST', path: 'stock-counts/7/complete' })
      )
    );
    expect(transport.calls()).not.toContainEqual(
      expect.objectContaining({ path: 'stock-counts/7/approve' })
    );
  });

  it('sends "Cancel Count" to the real cancel endpoint, not a DELETE the server never served', async () => {
    const transport = renderDetail();
    fireEvent.click(await screen.findByText(/Stock Count #7/));
    fireEvent.click(await screen.findByRole('button', { name: /Cancel Count/i }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({ method: 'POST', path: 'stock-counts/7/cancel' })
      )
    );
    expect(transport.calls()).not.toContainEqual(
      expect.objectContaining({ method: 'DELETE', path: 'stock-counts/7' })
    );
  });

  it('sends counted_qty, the field the server contract actually validates', async () => {
    const transport = renderDetail();
    fireEvent.click(await screen.findByText(/Stock Count #7/));
    const qtyInput = await screen.findByRole('spinbutton');
    fireEvent.change(qtyInput, { target: { value: '9' } });

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'PUT',
          path: 'stock-counts/7/items/101',
          body: { counted_qty: 9 },
        })
      )
    );
  });
});
