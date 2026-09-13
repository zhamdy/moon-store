import { describe, expect, it, vi } from 'vitest';
import { ProductsRepository } from '../src/modules/inventory/products/repository';

describe('ProductsRepository collection SQL', () => {
  it('reuses identical predicates and adds an id tie-break without per-row variant scans', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
    const result = await new ProductsRepository().list(
      {
        page: 1,
        pageSize: 25,
        sortBy: 'stock',
        sortOrder: 'desc',
        search: 'dress',
        lowStock: true,
      },
      { query } as any
    );
    expect(result).toEqual({ rows: [{ id: 1 }, { id: 2 }], total: 2 });
    const [countSql, countParams] = query.mock.calls[0];
    const [pageSql, pageParams] = query.mock.calls[1];
    expect(countSql).toContain('p.stock <= p.min_stock');
    expect(pageSql).toContain('p.stock <= p.min_stock');
    expect(pageSql).toMatch(/ORDER BY p\.stock DESC, p\.id ASC/);
    expect(pageSql).not.toMatch(/SELECT COUNT\(\*\).*product_variants/is);
    expect(pageSql).not.toMatch(/SELECT COALESCE\(SUM.*product_variants/is);
    expect(pageParams.slice(0, countParams.length)).toEqual(countParams);
  });

  it('uses a bounded parameterized array lookup and role visibility predicate', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 1, name: 'A' }] });
    const rows = await new ProductsRepository().lookup([1, 2], false, { query } as any);
    expect(rows).toHaveLength(1);
    expect(query.mock.calls[0][0]).toContain('p.id = ANY($1::int[])');
    expect(query.mock.calls[0][0]).toContain("p.status = 'active'");
    expect(query.mock.calls[0][1]).toEqual([[1, 2]]);
  });
});
