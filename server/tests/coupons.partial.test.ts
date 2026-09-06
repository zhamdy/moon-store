/**
 * Coupons: a partial PUT must not widen a scoped coupon (#78, same shape).
 *
 * `PUT /api/v1/coupons/:id` parsed the body with the create schema and then wrote all
 * twelve columns. The Promotions form has no input for `max_uses_per_customer` or
 * `scope_ids`, so every edit dropped a per-customer limit and cleared the scope list — a
 * coupon restricted to one category quietly became valid on the whole catalogue, which is
 * money rather than metadata.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { CouponsRepository } from '../src/modules/commerce/coupons/repository';
import { CouponsService } from '../src/modules/commerce/coupons/service';
import { couponUpdateSchema } from '../src/modules/commerce/coupons/schemas';
import { CouponError } from '../src/modules/commerce/coupons/types';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

describe('coupons partial update', () => {
  let testPool: PgPool;
  let couponId: number;
  const repo = new CouponsRepository();
  const service = new CouponsService(repo);

  beforeAll(async () => {
    testPool = createPgMemPool();
    setPool(testPool);
    await runMigrationsUp(testPool, MIGRATIONS_DIR);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM coupon_usage');
    await testPool.query('DELETE FROM coupons');
    const created = await testPool.query<{ id: number }>(
      `INSERT INTO coupons (code, type, value, min_purchase, max_uses, max_uses_per_customer, scope, scope_ids, stackable)
       VALUES ('EID20', 'percentage', 20, 500, 100, 1, 'category', '[3,4]', 1)
       RETURNING id`
    );
    couponId = created.rows[0].id;
  });

  it('keeps the per-customer limit and the scope the form cannot send', async () => {
    // Exactly the fields the Promotions form carries.
    await repo.update(couponId, {
      code: 'EID20',
      type: 'percentage',
      value: 25,
      min_purchase: 500,
      max_uses: 100,
      scope: 'category',
      stackable: true,
    });

    const coupon = await repo.findById(couponId);
    expect(coupon!.max_uses_per_customer).toBe(1);
    expect(coupon!.scope_ids).toEqual([3, 4]);
    expect(Number(coupon!.value)).toBe(25);
  });

  it('clears the scope list only when the body says null', async () => {
    await repo.update(couponId, { scope: 'all', scope_ids: null });

    const coupon = await repo.findById(couponId);
    expect(coupon!.scope).toBe('all');
    expect(coupon!.scope_ids).toBeNull();
  });

  it('keeps stackable off when the body omits it', async () => {
    await testPool.query('UPDATE coupons SET stackable = 0 WHERE id = $1', [couponId]);

    await repo.update(couponId, { value: 30 });

    expect(Number((await repo.findById(couponId))!.stackable)).toBe(0);
  });

  it('validates the percentage ceiling against the stored type, not the absent one', async () => {
    // The body raises the value without re-sending `type`. Reading the ceiling off the
    // body alone would let a 150% coupon through, because `type` is undefined there.
    await expect(service.update(couponId, { value: 150 })).rejects.toBeInstanceOf(CouponError);

    expect(Number((await repo.findById(couponId))!.value)).toBe(20);
  });

  it('allows a value above 100 once the body also switches the type to fixed', async () => {
    const updated = await service.update(couponId, { type: 'fixed', value: 150 });

    expect(updated.type).toBe('fixed');
    expect(Number(updated.value)).toBe(150);
  });
});

describe('couponUpdateSchema', () => {
  it('carries no defaults, so absent scope and stackable stay absent', () => {
    const parsed = couponUpdateSchema.parse({ value: 25 });

    expect(parsed).toEqual({ value: 25 });
    expect('scope' in parsed).toBe(false);
    expect('stackable' in parsed).toBe(false);
  });

  it('still normalises and validates what is present', () => {
    expect(couponUpdateSchema.parse({ code: ' eid20 ' })).toEqual({ code: 'EID20' });
    expect(couponUpdateSchema.safeParse({ value: -1 }).success).toBe(false);
    expect(couponUpdateSchema.safeParse({ code: 'ab' }).success).toBe(false);
  });
});
