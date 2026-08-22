import { describe, expect, it } from 'vitest';
import {
  parseCustomerListQuery,
  parseCustomerSalesQuery,
} from '../src/modules/commerce/customers/types';

describe('commerce collection contracts', () => {
  it('parses canonical customer collection queries', () => {
    expect(parseCustomerListQuery({ page: '2', pageSize: '25', search: 'Mona' })).toEqual({
      page: 2,
      pageSize: 25,
      search: 'Mona',
    });
    expect(parseCustomerSalesQuery({ page: '3', pageSize: '10' })).toEqual({
      page: 3,
      pageSize: 10,
    });
  });

  it('rejects legacy customer limits and unknown filters', () => {
    expect(() => parseCustomerListQuery({ limit: '1000' })).toThrow();
    expect(() => parseCustomerSalesQuery({ limit: '100' })).toThrow();
    expect(() => parseCustomerListQuery({ search: 'x'.repeat(101) })).toThrow();
  });
});
