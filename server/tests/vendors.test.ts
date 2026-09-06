/**
 * Vendors: a partial PUT must not reactivate a vendor (#78, same shape).
 *
 * `PUT /api/v1/vendors/:id` parsed the body with the create schema — every field optional,
 * `commission_rate` and `status` carrying a `.default()` — and then SET all eight columns.
 * The Vendors page sends four of them. So editing a vendor's phone number reset `status` to
 * `'active'`, undoing a deactivation, and cleared `contact_person` and `tax_number`.
 *
 * pg-mem is enough: this is single-connection merge behaviour, not concurrency.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { VendorsRepository } from '../src/modules/commerce/vendors/repository';
import { vendorUpdateSchema } from '../src/modules/commerce/vendors/schemas';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

describe('vendors partial update', () => {
  let testPool: PgPool;
  let vendorId: number;
  const repo = new VendorsRepository();

  beforeAll(async () => {
    testPool = createPgMemPool();
    setPool(testPool);
    await runMigrationsUp(testPool, MIGRATIONS_DIR);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM vendors');
    const created = await testPool.query<{ id: number }>(
      `INSERT INTO vendors (name, contact_person, email, phone, address, tax_number, commission_rate, status)
       VALUES ('Nile Textiles', 'Mona', 'mona@nile.example', '01000000000', '5 Corniche', 'TAX-9', 12, 'inactive')
       RETURNING id`
    );
    vendorId = created.rows[0].id;
  });

  const rowOf = async (id: number) => {
    const { rows } = await testPool.query('SELECT * FROM vendors WHERE id = $1', [id]);
    return rows[0];
  };

  it('does not reactivate a deactivated vendor when the body omits status', async () => {
    // Exactly the four fields the Vendors page's edit form sends.
    await repo.update(vendorId, {
      name: 'Nile Textiles',
      email: 'mona@nile.example',
      phone: '01011112222',
      address: '5 Corniche',
    });

    const row = await rowOf(vendorId);
    expect(row.status).toBe('inactive');
    expect(row.phone).toBe('01011112222');
  });

  it('keeps the fields the body never mentions', async () => {
    await repo.update(vendorId, { phone: '01011112222' });

    const row = await rowOf(vendorId);
    expect(row.contact_person).toBe('Mona');
    expect(row.tax_number).toBe('TAX-9');
    expect(Number(row.commission_rate)).toBe(12);
    expect(row.name).toBe('Nile Textiles');
  });

  it('still applies the fields it does mention, including a deliberate deactivation', async () => {
    await repo.update(vendorId, { status: 'active', commission_rate: 0 });
    expect((await rowOf(vendorId)).status).toBe('active');
    // commission_rate 0 is falsy and must survive: a truthiness guard would drop it.
    expect(Number((await rowOf(vendorId)).commission_rate)).toBe(0);

    await repo.update(vendorId, { status: 'inactive' });
    expect((await rowOf(vendorId)).status).toBe('inactive');
  });

  it('clears a nullable column when the body says null', async () => {
    await repo.update(vendorId, { tax_number: null });

    const row = await rowOf(vendorId);
    expect(row.tax_number).toBeNull();
    expect(row.contact_person).toBe('Mona');
  });

  it('leaves the row otherwise untouched when the body names nothing', async () => {
    const before = await rowOf(vendorId);
    const updated = await repo.update(vendorId, {});

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe(before.name);
    expect(updated!.status).toBe('inactive');
  });
});

describe('vendorUpdateSchema', () => {
  it('carries no defaults, so an absent field stays absent', () => {
    // The create schema defaults `commission_rate` to 0 and `status` to 'active'. If the
    // update schema kept those, the repository would receive them as *present* values and
    // write them — the merge below the schema could not tell the difference.
    const parsed = vendorUpdateSchema.parse({ phone: '01011112222' });

    expect(parsed).toEqual({ phone: '01011112222' });
    expect('status' in parsed).toBe(false);
    expect('commission_rate' in parsed).toBe(false);
  });

  it('accepts an explicit null on a nullable column', () => {
    expect(vendorUpdateSchema.parse({ tax_number: null })).toEqual({ tax_number: null });
  });

  it('still validates the fields that are present', () => {
    expect(vendorUpdateSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
    expect(vendorUpdateSchema.safeParse({ status: 'archived' }).success).toBe(false);
    expect(vendorUpdateSchema.safeParse({ name: '' }).success).toBe(false);
  });
});
