import { describe, expect, it } from 'vitest';
import { AnalyticsService } from '../src/modules/intelligence/analytics/service';
import type { IAnalyticsRepository } from '../src/modules/intelligence/analytics/repository';
import { CUSTOMER_SEGMENTS } from '../src/modules/intelligence/analytics/types';

type RfmRow = Awaited<ReturnType<IAnalyticsRepository['getCustomerRfmRaw']>>[number];

/**
 * A repository that answers only the one question segmentation asks. The scoring
 * is deliberately in the service rather than in SQL, which is what makes it
 * provable without a database.
 */
function serviceOver(rows: RfmRow[]): AnalyticsService {
  return new AnalyticsService({
    getCustomerRfmRaw: async () => rows,
  } as unknown as IAnalyticsRepository);
}

/** Ten customers spread evenly, so each quintile holds exactly two. */
function population(): RfmRow[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    name: `Customer ${i + 1}`,
    phone: `0100000000${i}`,
    email: null,
    loyalty_points: i * 10,
    // Customer 1 bought yesterday and often; customer 10 long ago and once.
    recency_days: i * 30,
    frequency: 10 - i,
    monetary: (10 - i) * 500,
  }));
}

describe('RFM customer segmentation', () => {
  it('labels the best and worst of a spread population as champions and lost', async () => {
    const { data } = await serviceOver(population()).getCustomerSegmentsPage(1, 25);

    const byId = new Map(data.customers.map((c) => [c.id, c.segment]));
    expect(byId.get(1)).toBe('champions');
    expect(byId.get(2)).toBe('champions');
    expect(byId.get(10)).toBe('lost');
  });

  it('gives every scored customer exactly one of the seven segments', async () => {
    const { data } = await serviceOver(population()).getCustomerSegmentsPage(1, 25);

    expect(data.customers).toHaveLength(10);
    for (const customer of data.customers) {
      expect(CUSTOMER_SEGMENTS).toContain(customer.segment);
    }
    const summed = data.summary.reduce((total, row) => total + row.count, 0);
    expect(summed).toBe(10);
  });

  it('rolls up all seven segments even when nobody is in them', async () => {
    const { data } = await serviceOver(population()).getCustomerSegmentsPage(1, 25);

    expect(data.summary.map((s) => s.segment)).toEqual([...CUSTOMER_SEGMENTS]);
    for (const row of data.summary) {
      if (row.count === 0) {
        expect(row.total_revenue).toBe(0);
        expect(row.avg_frequency).toBe(0);
      }
    }
  });

  it('summarises the whole population regardless of the page or the filter', async () => {
    const service = serviceOver(population());

    const unfiltered = await service.getCustomerSegmentsPage(1, 3);
    const filtered = await service.getCustomerSegmentsPage(1, 3, 'champions');
    const lastPage = await service.getCustomerSegmentsPage(4, 3);

    expect(unfiltered.data.customers).toHaveLength(3);
    expect(unfiltered.totalItems).toBe(10);
    expect(lastPage.data.customers).toHaveLength(1);
    // The tiles are the control for the filter; they must not move when it is applied.
    expect(filtered.data.summary).toEqual(unfiltered.data.summary);
    expect(lastPage.data.summary).toEqual(unfiltered.data.summary);
  });

  it('returns only the requested segment, and counts only that segment', async () => {
    const service = serviceOver(population());
    const all = await service.getCustomerSegmentsPage(1, 100);
    const championCount = all.data.summary.find((s) => s.segment === 'champions')?.count ?? 0;

    const filtered = await service.getCustomerSegmentsPage(1, 100, 'champions');

    expect(filtered.totalItems).toBe(championCount);
    expect(filtered.data.customers.every((c) => c.segment === 'champions')).toBe(true);
  });

  it('scores a single customer without dividing by zero', async () => {
    const only = population().slice(0, 1);
    const { data, totalItems } = await serviceOver(only).getCustomerSegmentsPage(1, 25);

    expect(totalItems).toBe(1);
    expect(data.customers[0].segment).toBe('champions');
  });

  it('returns an empty page and a zeroed roll-up when nobody has bought anything', async () => {
    const { data, totalItems } = await serviceOver([]).getCustomerSegmentsPage(1, 25);

    expect(totalItems).toBe(0);
    expect(data.customers).toEqual([]);
    expect(data.summary.every((row) => row.count === 0)).toBe(true);
  });

  it('coerces the numeric strings PostgreSQL returns for NUMERIC columns', async () => {
    const rows: RfmRow[] = [
      {
        id: 1,
        name: 'Numeric strings',
        phone: null,
        email: null,
        loyalty_points: null,
        recency_days: '12',
        frequency: '3',
        monetary: '1500.50',
      },
    ];

    const { data } = await serviceOver(rows).getCustomerSegmentsPage(1, 25);

    expect(data.customers[0]).toMatchObject({
      recency_days: 12,
      frequency: 3,
      monetary: 1500.5,
      loyalty_points: 0,
    });
  });
});
