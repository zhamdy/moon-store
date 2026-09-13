import { describe, expect, it } from 'vitest';
import {
  parseAnalyticsDateQuery,
  parseAnalyticsDaysPageQuery,
  parseAnalyticsDaysQuery,
  parseAnalyticsPageQuery,
  analyticsSegmentQuerySchema,
} from '../src/modules/intelligence/analytics/types';
import { parseNotificationListQuery } from '../src/modules/intelligence/notifications/types';
import { parseSalesReportQuery } from '../src/modules/intelligence/reports/types';

describe('intelligence collection contracts', () => {
  it('parses canonical analytics pagination', () => {
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
  });

  it('parses the RFM segment filter and rejects a segment it cannot produce', () => {
    expect(analyticsSegmentQuerySchema.parse({ page: '2', segment: 'at_risk' })).toEqual({
      page: 2,
      pageSize: 25,
      segment: 'at_risk',
    });
    expect(analyticsSegmentQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(() => analyticsSegmentQuerySchema.parse({ segment: 'vip' })).toThrow();
    expect(() => analyticsSegmentQuerySchema.parse({ from: '2026-01-01' })).toThrow();
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
    expect(() => parseAnalyticsPageQuery({ sortBy: 'value' })).toThrow();
    expect(() => parseAnalyticsPageQuery({ from: '2026-01-01' })).toThrow();
    expect(() => parseAnalyticsPageQuery({ from: '2026-02-01', to: '2026-01-01' })).toThrow();
    expect(() => parseAnalyticsDaysQuery({ page: '2' }, 30)).toThrow();
    expect(() => parseNotificationListQuery({ unread_only: 'true' })).toThrow();
    expect(() => parseSalesReportQuery({ limit: '50' })).toThrow();
    expect(() => parseSalesReportQuery({ from: '2026-99-99' })).toThrow();
  });
});
