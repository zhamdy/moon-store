import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { getStorePolicies } from './get-store-policies';
import { loadStorePolicies } from './load-store-policies';

vi.mock('./get-store-policies', () => ({ getStorePolicies: vi.fn() }));

const get = vi.mocked(getStorePolicies);

afterEach(() => {
  vi.restoreAllMocks();
  get.mockReset();
});

describe('loadStorePolicies', () => {
  it('passes the policies through', async () => {
    const policies = { delivery: 'a', deliveryEn: null, returns: null, returnsEn: null };
    get.mockResolvedValue(policies);
    await expect(loadStorePolicies()).resolves.toBe(policies);
  });

  it.each([
    new ApiError({ status: 503, code: 'NETWORK_ERROR', message: 'down' }),
    new ApiError({ status: 404, code: 'NOT_FOUND', message: 'older API' }),
    new ApiError({ status: 200, code: 'INVALID_RESPONSE', message: 'bad shape' }),
  ])('contains $code as null, logged once', async (error) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    get.mockRejectedValue(error);

    await expect(loadStorePolicies()).resolves.toBeNull();
    expect(log).toHaveBeenCalledOnce();
  });

  it('propagates anything that is not an ApiError', async () => {
    const bug = new TypeError('boom');
    get.mockRejectedValue(bug);
    await expect(loadStorePolicies()).rejects.toBe(bug);
  });
});
