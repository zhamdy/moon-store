/**
 * Delivery orders against real PostgreSQL: resolving the customer a delivery is for (#150).
 *
 * Real PostgreSQL rather than pg-mem because the defect is entirely a matter of what the
 * UNIQUE index on `customers.phone` does to an insert that did not look first, and of
 * what `ON CONFLICT` does about it.
 */
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from './support/realPostgres';
import { DeliveryRepository } from '../src/modules/fulfillment/delivery/repository';
import { DeliveryService } from '../src/modules/fulfillment/delivery/service';

const delivery = (overrides: Record<string, unknown> = {}) => ({
  customer_name: 'Nadia Hassan',
  phone: '01000000000',
  address: '12 Nile St, Cairo',
  items: [{ product_id: 1, quantity: 1, price: 500 }],
  ...overrides,
});

describeWithPostgres('delivery orders — resolving the customer (#150)', () => {
  let harness: RealPostgresHarness;
  const repo = new DeliveryRepository();
  const service = new DeliveryService(repo);

  beforeAll(async () => {
    harness = await setupRealPostgres('delivery-customer', { maxConnections: 4 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
    await harness.pool.query(
      `INSERT INTO products (id, name, sku, price, cost_price, stock)
       VALUES (1, 'Silk Dress', 'SKU-001', 500, 250, 10)`
    );
  });

  async function customerRows(phone: string) {
    const { rows } = await harness.pool.query<{ id: number; name: string; address: string }>(
      'SELECT id, name, address FROM customers WHERE phone = $1',
      [phone]
    );
    return rows;
  }

  it('reuses the existing customer when the phone is already known', async () => {
    // The repro. Before the upsert this raised 23505 on `customers_phone_key`, which
    // nothing in the module mapped, so the operator got a 500 for a returning customer.
    const { rows } = await harness.pool.query<{ id: number }>(
      `INSERT INTO customers (name, phone, address)
       VALUES ('Nadia H.', '01000000000', '3 Old Address') RETURNING id`
    );
    const existingId = rows[0].id;

    const order = await service.createDeliveryOrder(delivery());

    expect(order.customer_id).toBe(existingId);
    expect(await customerRows('01000000000')).toHaveLength(1);
  });

  it('leaves the existing customer name and address alone', async () => {
    // The delivery form's fields describe where this parcel goes, not who the customer
    // is. Overwriting the customer record from an order would let a typo on one delivery
    // rewrite the address of every future one.
    await harness.pool.query(
      `INSERT INTO customers (name, phone, address)
       VALUES ('Nadia H.', '01000000000', '3 Old Address')`
    );

    await service.createDeliveryOrder(
      delivery({ customer_name: 'N. Hassan', address: '12 Nile St, Cairo' })
    );

    const [customer] = await customerRows('01000000000');
    expect(customer.name).toBe('Nadia H.');
    expect(customer.address).toBe('3 Old Address');
  });

  it('creates a customer when the phone is new', async () => {
    const order = await service.createDeliveryOrder(delivery({ phone: '01555000222' }));

    const rows = await customerRows('01555000222');
    expect(rows).toHaveLength(1);
    expect(order.customer_id).toBe(rows[0].id);
    expect(rows[0].name).toBe('Nadia Hassan');
  });

  it('still validates an explicitly supplied customer_id', async () => {
    await expect(
      service.createDeliveryOrder(delivery({ customer_id: 9999 }))
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('reuses the existing customer on update too', async () => {
    // `updateDeliveryOrder` resolves the customer through the same helper, so it carried
    // the same defect.
    const created = await service.createDeliveryOrder(delivery({ phone: '01555000333' }));
    await harness.pool.query(
      `INSERT INTO customers (name, phone, address) VALUES ('Someone Else', '01555000444', 'x')`
    );

    const updated = await service.updateDeliveryOrder(
      created.id,
      delivery({ phone: '01555000444', customer_name: 'Someone Else' })
    );

    const [customer] = await customerRows('01555000444');
    expect(updated.customer_id).toBe(customer.id);
    expect(await customerRows('01555000444')).toHaveLength(1);
  });
});
