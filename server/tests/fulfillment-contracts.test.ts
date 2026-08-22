import { describe, expect, it } from 'vitest';
import {
  parseDeliveryHistoryQuery,
  parseDeliveryListQuery,
} from '../src/modules/fulfillment/delivery/types';
import { parseExpenseListQuery } from '../src/modules/fulfillment/expenses/types';
import { parsePurchaseOrderListQuery } from '../src/modules/fulfillment/purchaseOrders/types';

describe('fulfillment collection contracts', () => {
  it('parses canonical delivery and status-history pagination', () => {
    expect(parseDeliveryListQuery({ page: '2', pageSize: '50', status: 'Shipped' })).toMatchObject({
      page: 2,
      pageSize: 50,
      status: 'Shipped',
    });
    expect(parseDeliveryHistoryQuery({ page: '1', pageSize: '25' })).toEqual({
      page: 1,
      pageSize: 25,
    });
  });

  it('parses canonical purchase-order and expense filters', () => {
    expect(
      parsePurchaseOrderListQuery({ page: '3', pageSize: '10', distributorId: '4' })
    ).toMatchObject({
      page: 3,
      pageSize: 10,
      distributorId: 4,
    });
    expect(parseExpenseListQuery({ page: '1', pageSize: '25', category: 'rent' })).toEqual({
      page: 1,
      pageSize: 25,
      category: 'rent',
      from: undefined,
      to: undefined,
    });
  });

  it('rejects legacy limits and unknown snake-case filters', () => {
    expect(() => parseDeliveryListQuery({ limit: '100' })).toThrow();
    expect(() => parseDeliveryHistoryQuery({ limit: '100' })).toThrow();
    expect(() => parsePurchaseOrderListQuery({ distributor_id: '4' })).toThrow();
    expect(() => parseExpenseListQuery({ limit: '100' })).toThrow();
  });
});
