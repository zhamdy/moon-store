import { describe, expect, it } from 'vitest';
import {
  parseAnalyticsDateQuery,
  parseAnalyticsDaysPageQuery,
  parseAnalyticsDaysQuery,
  parseAnalyticsPageQuery,
} from '../src/modules/intelligence/analytics/types';
import {
  parseAiListQuery,
  parseForecastQuery,
  parseRecommendationQuery,
} from '../src/modules/intelligence/ai/types';
import { parseNotificationListQuery } from '../src/modules/intelligence/notifications/types';
import { parseSalesReportQuery } from '../src/modules/intelligence/reports/types';

describe('intelligence collection contracts', () => {
  it('parses canonical analytics and AI pagination', () => {
    expect(
      parseAnalyticsPageQuery({ page: '2', pageSize: '50', from: '2026-01-01', to: '2026-02-01' })
    ).toMatchObject({
      page: 2,
      pageSize: 50,
      from: '2026-01-01',
      to: '2026-02-01',
    });
    expect(parseAnalyticsDaysPageQuery({ days: '90' }, 30)).toMatchObject({
      page: 1,
      pageSize: 25,
      days: 90,
    });
    expect(parseAnalyticsDaysQuery({ days: '30' }, 90)).toEqual({ days: 30 });
    expect(parseAiListQuery({ page: '3', pageSize: '10' })).toEqual({ page: 3, pageSize: 10 });
    expect(parseRecommendationQuery({ productId: '7' })).toMatchObject({ productId: 7 });
  });

  it('parses notifications and sales reports with canonical names', () => {
    expect(parseNotificationListQuery({ page: '1', pageSize: '25', unreadOnly: 'true' })).toEqual({
      page: 1,
      pageSize: 25,
      unreadOnly: true,
    });
    expect(parseSalesReportQuery({ page: '2', pageSize: '50', groupBy: 'month' })).toMatchObject({
      page: 2,
      pageSize: 50,
      groupBy: 'month',
    });
  });

  it('rejects legacy and unknown query parameters', () => {
    expect(() => parseAnalyticsDateQuery({ unexpected: 'x' })).toThrow();
    expect(() => parseAnalyticsPageQuery({ limit: '100' })).toThrow();
    expect(() => parseAiListQuery({ limit: '100' })).toThrow();
    expect(() => parseForecastQuery({ page: '1' })).toThrow();
    expect(() => parseAiListQuery({ sortBy: 'name' })).toThrow();
    expect(() => parseAiListQuery({ sortOrder: 'desc' })).toThrow();
    expect(() => parseAnalyticsPageQuery({ sortBy: 'value' })).toThrow();
    expect(() => parseAnalyticsPageQuery({ from: '2026-01-01' })).toThrow();
    expect(() => parseAnalyticsPageQuery({ from: '2026-02-01', to: '2026-01-01' })).toThrow();
    expect(() => parseAnalyticsDaysQuery({ page: '2' }, 30)).toThrow();
    expect(() => parseNotificationListQuery({ unread_only: 'true' })).toThrow();
    expect(() => parseSalesReportQuery({ limit: '50' })).toThrow();
    expect(() => parseSalesReportQuery({ from: '2026-99-99' })).toThrow();
  });
});
