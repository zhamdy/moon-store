import { beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import RefundDialog from './RefundDialog';
import type { SaleItem, SaleRefund } from '../types';

function wrapperFor(transport: MemoryTransport) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

const dress: SaleItem = {
  product_id: 1,
  product_name: 'Silk Dress',
  quantity: 3,
  unit_price: 500,
};

function renderDialog(items: SaleItem[], refunds: SaleRefund[] = []) {
  const transport = createMemoryTransport({ sales: [] });
  render(
    <RefundDialog
      open
      onOpenChange={() => {}}
      saleId={42}
      saleTotal={items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)}
      refundedAmount={refunds.reduce((sum, r) => sum + r.amount, 0)}
      items={items}
      refunds={refunds}
    />,
    { wrapper: wrapperFor(transport) }
  );
  return transport;
}

const refundOf = (items: SaleItem[], amount: number): SaleRefund => ({
  id: 1,
  amount,
  reason: 'Customer Return',
  cashier_name: 'Sarah',
  created_at: '2026-09-09T00:00:00.000Z',
  items,
});

describe('RefundDialog line accounting (#120, #121)', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
  });

  it('offers the whole sold quantity when nothing has been refunded', () => {
    renderDialog([dress]);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Silk Dress' }));

    const qty = screen.getByRole('spinbutton', { name: 'Qty to refund' });
    expect(qty).toHaveValue(3);
    expect(qty).toHaveAttribute('max', '3');
  });

  it('offers only what is left after a partial refund', () => {
    renderDialog([dress], [refundOf([{ ...dress, quantity: 1 }], 500)]);

    expect(screen.getByText(/2 of 3 left to refund/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Silk Dress' }));

    const qty = screen.getByRole('spinbutton', { name: 'Qty to refund' });
    expect(qty).toHaveValue(2);
    expect(qty).toHaveAttribute('max', '2');
  });

  it('disables a fully refunded line and says so in words, not only by dimming it', () => {
    renderDialog([dress], [refundOf([{ ...dress, quantity: 3 }], 1500)]);

    expect(screen.getByRole('checkbox', { name: 'Select Silk Dress' })).toBeDisabled();
    expect(screen.getByText('Fully refunded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /process refund/i })).toBeDisabled();
  });

  it('renders two variants of one product as two independently selectable lines', () => {
    const red: SaleItem = {
      product_id: 1,
      variant_id: 10,
      variant_sku: 'DRESS-RED',
      product_name: 'Silk Dress',
      quantity: 1,
      unit_price: 500,
    };
    const blue: SaleItem = { ...red, variant_id: 11, variant_sku: 'DRESS-BLUE' };

    // The red variant is spent; the blue one is untouched. Keyed on product_id alone
    // these would be one row, and the blue line would be unreachable.
    renderDialog([red, blue], [refundOf([{ ...red, quantity: 1 }], 500)]);

    expect(screen.getByRole('checkbox', { name: 'Select Silk Dress (DRESS-RED)' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Select Silk Dress (DRESS-BLUE)' })).toBeEnabled();
  });

  it('submits variant_id for a variant line and omits it for a plain one', async () => {
    const variant: SaleItem = {
      product_id: 1,
      variant_id: 10,
      variant_sku: 'DRESS-RED',
      product_name: 'Silk Dress',
      quantity: 1,
      unit_price: 500,
    };
    const plain: SaleItem = {
      product_id: 2,
      product_name: 'Cotton Shirt',
      quantity: 1,
      unit_price: 200,
    };
    const transport = renderDialog([variant, plain]);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Silk Dress (DRESS-RED)' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Cotton Shirt' }));
    fireEvent.click(screen.getByRole('button', { name: /process refund/i }));

    await screen.findByRole('dialog');
    const refundCall = transport.calls().find((c) => c.path.includes('refund'));
    expect(refundCall).toBeDefined();
    expect((refundCall?.body as { items: unknown[] }).items).toEqual([
      { product_id: 1, variant_id: 10, quantity: 1, unit_price: 500 },
      { product_id: 2, quantity: 1, unit_price: 200 },
    ]);
  });

  it('prices the refund from the sale line, per selected quantity', () => {
    renderDialog([dress]);

    // The summary row, scoped by its own label -- '500' also appears in each line's
    // "500 x 3" caption, so an unscoped text match would be ambiguous.
    const summary = () => screen.getByText('Refund Amount').parentElement as HTMLElement;

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Silk Dress' }));
    expect(summary().textContent).toMatch(/1,500/);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Qty to refund' }), {
      target: { value: '1' },
    });
    expect(summary().textContent).toMatch(/(^|[^,\d])500/);
  });
});
