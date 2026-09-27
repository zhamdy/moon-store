import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveApiBaseUrl } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { CatalogCategory } from '../types/catalog-category';
import { listCatalogCategories } from './list-catalog-categories';
import { CATEGORY_COUNTS_TIMEOUT_MS, loadCategoryCounts } from './load-category-counts';

vi.mock('./list-catalog-categories', () => ({ listCatalogCategories: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ resolveApiBaseUrl: vi.fn() }));

const list = vi.mocked(listCatalogCategories);
const baseUrl = vi.mocked(resolveApiBaseUrl);

afterEach(() => {
  vi.restoreAllMocks();
  list.mockReset();
  baseUrl.mockReset();
});

const category = (slug: string, productCount: number): CatalogCategory => ({
  slug,
  name: slug,
  nameEn: slug,
  description: null,
  descriptionEn: null,
  productCount,
});

describe('loadCategoryCounts', () => {
  it('maps each slug to its piece count, zero included', async () => {
    baseUrl.mockReturnValue('http://api.test');
    list.mockResolvedValue([category('dresses', 4), category('bags', 0)]);

    const counts = await loadCategoryCounts();
    expect(counts?.get('dresses')).toBe(4);
    expect(counts?.get('bags')).toBe(0);
    expect(counts?.has('tops')).toBe(false);
  });

  // The layout awaits this on every page, prerendered ones included.
  it('reads with a deadline', async () => {
    baseUrl.mockReturnValue('http://api.test');
    list.mockResolvedValue([]);

    await loadCategoryCounts();
    expect(list).toHaveBeenCalledWith({ timeoutMs: CATEGORY_COUNTS_TIMEOUT_MS });
  });

  it('is null when the read fails, logged once', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    baseUrl.mockReturnValue('http://api.test');
    list.mockRejectedValue(new ApiError({ status: 0, code: 'TIMEOUT', message: 'timed out' }));

    await expect(loadCategoryCounts()).resolves.toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('is null without asking when no API is configured', async () => {
    baseUrl.mockImplementation(() => {
      throw new Error('API_URL is not set');
    });

    await expect(loadCategoryCounts()).resolves.toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it('rethrows anything that is not an ApiError', async () => {
    baseUrl.mockReturnValue('http://api.test');
    list.mockRejectedValue(new TypeError('boom'));

    await expect(loadCategoryCounts()).rejects.toThrow('boom');
  });
});
