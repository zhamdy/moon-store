/**
 * Shipping companies: a partial PUT must not re-enable a disabled company (#78, same shape).
 *
 * `ShippingCompaniesDialog` sends `{ name, phone, website }` and nothing else. The endpoint
 * parsed that with the create schema and SET all five columns, so `email` and
 * `tracking_url_template` were wiped on every edit and `is_active`'s `.default(true)`
 * re-enabled a company an admin had just disabled — a courier that had been taken out of
 * service silently reappearing in the delivery form.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { ShippingCompaniesRepository } from '../src/modules/fulfillment/shippingCompanies/repository';
import { shippingCompanyUpdateSchema } from '../src/modules/fulfillment/shippingCompanies/schemas';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

describe('shipping companies partial update', () => {
  let testPool: PgPool;
  let companyId: number;
  const repo = new ShippingCompaniesRepository();

  beforeAll(async () => {
    testPool = createPgMemPool();
    setPool(testPool);
    await runMigrationsUp(testPool, MIGRATIONS_DIR);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM shipping_companies');
    const created = await testPool.query<{ id: number }>(
      `INSERT INTO shipping_companies (name, phone, email, tracking_url_template, is_active)
       VALUES ('Delta Courier', '01000000000', 'ops@delta.example', 'https://delta.example/t/{code}', 0)
       RETURNING id`
    );
    companyId = created.rows[0].id;
  });

  const rowOf = async (id: number) => {
    const { rows } = await testPool.query('SELECT * FROM shipping_companies WHERE id = $1', [id]);
    return rows[0];
  };

  it('does not re-enable a disabled company when the body omits is_active', async () => {
    // Exactly what the dialog sends.
    await repo.update(companyId, { name: 'Delta Courier', phone: '01011112222' });

    const row = await rowOf(companyId);
    expect(Number(row.is_active)).toBe(0);
    expect(row.phone).toBe('01011112222');
  });

  it('keeps the fields the dialog never sends', async () => {
    await repo.update(companyId, { name: 'Delta Courier', phone: '01011112222' });

    const row = await rowOf(companyId);
    expect(row.email).toBe('ops@delta.example');
    expect(row.tracking_url_template).toBe('https://delta.example/t/{code}');
  });

  it('still applies an explicit enable and an explicit clear', async () => {
    await repo.update(companyId, { is_active: true });
    expect(Number((await rowOf(companyId)).is_active)).toBe(1);

    await repo.update(companyId, { tracking_url_template: null });
    const row = await rowOf(companyId);
    expect(row.tracking_url_template).toBeNull();
    expect(Number(row.is_active)).toBe(1);
  });
});

describe('shippingCompanyUpdateSchema', () => {
  it('carries no is_active default, so an absent flag stays absent', () => {
    const parsed = shippingCompanyUpdateSchema.parse({ name: 'Delta Courier' });

    expect(parsed).toEqual({ name: 'Delta Courier' });
    expect('is_active' in parsed).toBe(false);
  });

  it('still validates what is present', () => {
    expect(shippingCompanyUpdateSchema.safeParse({ email: 'nope' }).success).toBe(false);
    expect(shippingCompanyUpdateSchema.safeParse({ email: null }).success).toBe(true);
  });
});
