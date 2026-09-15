import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import type { StorePolicies } from '../types/store-policies';
import { getStorePolicies } from './get-store-policies';

/**
 * The product page's policies read, or `null`. An `ApiError` (outage, 404 from an older
 * API, malformed body) is logged and yields `null`, so the Shipping tab disappears
 * instead of the loaded product being replaced by the error screen; anything else is a
 * bug and propagates. `unstable_rethrow` runs first so Next's own control-flow errors
 * are never swallowed.
 */
export async function loadStorePolicies(): Promise<StorePolicies | null> {
  try {
    return await getStorePolicies();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      console.error(`Store policies read failed: ${error.code} ${error.status}`);
      return null;
    }
    throw error;
  }
}
