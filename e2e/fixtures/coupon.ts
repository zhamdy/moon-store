/**
 * Worker-namespaced coupons.
 *
 * `max_uses` counting is guarded server-side with `SELECT ... FOR UPDATE` on `coupons`,
 * so a coupon shared between workers would have its usage count perturbed by whoever else
 * happened to redeem it. Every coupon here belongs to exactly one test.
 */
import type { APIRequestContext } from '@playwright/test';
import { API_BASE } from './seed';

export interface CouponSeed {
  type?: 'percentage' | 'fixed';
  value: number;
  maxUses?: number;
  expiresAt?: string;
  minPurchase?: number;
}

export interface Coupon {
  id: number;
  code: string;
  type: string;
  value: number | string;
}

/**
 * Codes are uppercased and trimmed by the server's own schema, so the code this returns
 * is what the server stored — not what was sent.
 */
export async function createCoupon(
  request: APIRequestContext,
  namespace: string,
  label: string,
  seed: CouponSeed
): Promise<Coupon> {
  const code = `${namespace}-${label}-${Math.random().toString(36).slice(2, 7)}`
    .toUpperCase()
    .slice(0, 50);

  const response = await request.post(`${API_BASE}/coupons`, {
    data: {
      code,
      type: seed.type ?? 'fixed',
      value: seed.value,
      ...(seed.maxUses !== undefined ? { max_uses: seed.maxUses } : {}),
      ...(seed.expiresAt !== undefined ? { expires_at: seed.expiresAt } : {}),
      ...(seed.minPurchase !== undefined ? { min_purchase: seed.minPurchase } : {}),
    },
  });

  if (!response.ok()) {
    throw new Error(`create coupon ${code} failed: ${response.status()} ${await response.text()}`);
  }
  return ((await response.json()) as { data: Coupon }).data;
}
