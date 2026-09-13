import { describe, expect, it, vi } from 'vitest';
import { AnalyticsRepository } from '../src/modules/intelligence/analytics/repository';

describe('Intelligence repository pagination', () => {
  it('counts the complete analytics result before applying LIMIT and OFFSET', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: '51' }] })
      .mockResolvedValueOnce({ rows: [{ name: 'paged' }] });
    const repo = new AnalyticsRepository();

    const result = await repo.getAggregatePage(
      'SELECT name FROM products WHERE status = $1 ORDER BY id',
      ['active'],
      3,
      10,
      { query } as never
    );

    expect(result).toEqual({ rows: [{ name: 'paged' }], totalItems: 51 });
    expect(query.mock.calls[0][0]).toContain('SELECT COUNT(*)');
    expect(query.mock.calls[1]).toEqual([
      'SELECT name FROM products WHERE status = $1 ORDER BY id LIMIT $2 OFFSET $3',
      ['active', 10, 20],
    ]);
  });
});
