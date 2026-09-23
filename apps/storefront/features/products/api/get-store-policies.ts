import 'server-only';
import { CATALOG_REVALIDATE, catalogFetch, catalogTags } from '@/lib/api/catalog';
import { CATALOG_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/errors';
import type { StorePolicies } from '../types/store-policies';

const FIELDS = ['delivery', 'deliveryEn', 'returns', 'returnsEn'] as const;

function invalid(message: string): ApiError {
  return new ApiError({ status: 200, code: 'INVALID_RESPONSE', message });
}

/**
 * The store policies, with the entity lifetime and no `timeoutMs` (entity-read
 * convention). A missing field reads as `null`, so an older API that lacks one still
 * renders; any other shape throws `INVALID_RESPONSE`. Every failure throws: the page
 * contains them through `loadStorePolicies`.
 */
export async function getStorePolicies(): Promise<StorePolicies> {
  const { data } = await catalogFetch<unknown>(
    CATALOG_ENDPOINTS.storePolicies,
    CATALOG_REVALIDATE.entity,
    [catalogTags.storePolicies]
  );
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw invalid('Store policies response is not an object');
  }

  const record = data as Record<string, unknown>;
  const policies = {} as StorePolicies;
  for (const field of FIELDS) {
    const value = record[field];
    if (value === undefined || value === null) policies[field] = null;
    else if (typeof value === 'string') policies[field] = value;
    else throw invalid(`Store policies field "${field}" is not a string`);
  }
  return policies;
}
