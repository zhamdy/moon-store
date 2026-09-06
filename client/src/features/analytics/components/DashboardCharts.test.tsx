import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../shared/tests/testUtils';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import DashboardCharts from './DashboardCharts';
import type { CashierPerformance } from '../hooks/useDashboardData';

const CASHIER = {
  cashier_id: 1,
  cashier_name: 'Sarah',
  total_sales: 4,
  total_revenue: 400,
  avg_order_value: 100,
  total_items: 9,
} as CashierPerformance;

function renderCharts(
  cashierPerformance: CashierPerformance[] | undefined,
  cashierLoading = false
) {
  return renderWithProviders(
    <DashboardCharts
      revenue={[]}
      revenueLoading={false}
      topProducts={[]}
      topLoading={false}
      paymentMethods={[]}
      paymentLoading={false}
      ordersPerDay={[]}
      ordersLoading={false}
      cashierPerformance={cashierPerformance}
      cashierLoading={cashierLoading}
      categorySales={[]}
      categoryLoading={false}
      distributorSales={[]}
      distributorLoading={false}
      onExportCsv={() => {}}
    />
  );
}

/**
 * #105: the cashier table announced its empty state from `role="status"` on the `<td>`,
 * which stopped the cell being a cell. The region now sits outside the table and outside
 * the loading branch, so it is mounted before the transition it has to announce.
 */
describe('DashboardCharts cashier table announcements', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('keeps the empty row a real cell with no status role inside the table', () => {
    renderCharts([]);

    expect(document.querySelector('td[role]')).toBeNull();
    expect(document.querySelector('table [role="status"]')).toBeNull();
  });

  it('announces from a region that survives the transition from rows to none', () => {
    const { rerender } = renderCharts([CASHIER]);

    // Scoped: other cards on this dashboard legitimately own live regions of their own.
    const region = screen.getByTestId('cashier-performance-status');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveTextContent('1 results');

    rerender(
      <DashboardCharts
        revenue={[]}
        revenueLoading={false}
        topProducts={[]}
        topLoading={false}
        paymentMethods={[]}
        paymentLoading={false}
        ordersPerDay={[]}
        ordersLoading={false}
        cashierPerformance={[]}
        cashierLoading={false}
        categorySales={[]}
        categoryLoading={false}
        distributorSales={[]}
        distributorLoading={false}
        onExportCsv={() => {}}
      />
    );

    expect(screen.getByTestId('cashier-performance-status')).toBe(region);
    expect(region).toHaveTextContent('No results found.');
    // The table structure survives the swap.
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
  });

  it('stays silent while the request is still out', () => {
    renderCharts(undefined, true);

    expect(screen.getByTestId('cashier-performance-status')).toHaveTextContent('');
  });
});
