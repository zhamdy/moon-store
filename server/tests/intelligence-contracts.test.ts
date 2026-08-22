import { describe, expect, it } from 'vitest';
import {
  parseAnalyticsDateQuery,
  parseAnalyticsDaysPageQuery,
  parseAnalyticsPageQuery,
} from '../src/modules/intelligence/analytics/types';
import { parseAiListQuery, parseRecommendationQuery } from '../src/modules/intelligence/ai/types';
import { parseNotificationListQuery } from '../src/modules/intelligence/notifications/types';
import { parseSalesReportQuery } from '../src/modules/intelligence/reports/types';

describe('intelligence collection contracts', () => {
  it('parses canonical analytics and AI pagination', () => {
    expect(
      parseAnalyticsPageQuery({ page: '2', pageSize: '50', from: '2026-01-01' })
    ).toMatchObject({
      page: 2,
      pageSize: 50,
      from: '2026-01-01',
    });
    expect(parseAnalyticsDaysPageQuery({ days: '90' }, 30)).toMatchObject({
      page: 1,
      pageSize: 25,
      days: 90,
    });
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
    expect(() => parseNotificationListQuery({ unread_only: 'true' })).toThrow();
    expect(() => parseSalesReportQuery({ limit: '50' })).toThrow();
  });
});
