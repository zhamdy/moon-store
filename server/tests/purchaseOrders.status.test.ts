/**
 * `PurchaseOrdersService`/`PurchaseOrdersController` status transitions (#119).
 *
 * Migration 010 narrows `purchase_orders_status_check` to the application vocabulary
 * (`Draft`, `Sent`, `Partially Received`, `Received`, `Cancelled`). Before it, a status
 * write past `Draft` hit an unmapped SQLSTATE 23514 and surfaced as a 500. This exercises
 * the whole path against real PostgreSQL: create -> send -> partial receive -> receive.
 */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from './support/realPostgres';
import { PurchaseOrdersController } from '../src/modules/fulfillment/purchaseOrders/controller';
import { purchaseOrdersService } from '../src/modules/fulfillment/purchaseOrders/service';

interface CapturedResponse {
  status: number | null;
  body: unknown;
}

describeWithPostgres('purchase order status vocabulary (#119)', () => {
  let harness: RealPostgresHarness;
  let userId: number;
  let distributorId: number;
  let productId: number;

  beforeAll(async () => {
    harness = await setupRealPostgres('purchase-orders-status');
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();

    const users = await harness.pool.query<{ id: number }>(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', 'admin@moon.com', 'x', 'Admin') RETURNING id"
    );
    userId = users.rows[0].id;

    const distributors = await harness.pool.query<{ id: number }>(
      "INSERT INTO distributors (name) VALUES ('Acme Textiles') RETURNING id"
    );
    distributorId = distributors.rows[0].id;

    const products = await harness.pool.query<{ id: number }>(
      "INSERT INTO products (name, sku, price, stock) VALUES ('Silk Scarf', 'SKU-PO1', 100, 0) RETURNING id"
    );
    productId = products.rows[0].id;
  });

  async function stockOf(id: number): Promise<number> {
    const { rows } = await harness.pool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [id]
    );
    return Number(rows[0].stock);
  }

  it('moves Draft -> Sent -> Partially Received -> Received, committing stock on each receive (R1)', async () => {
    const created = await purchaseOrdersService.create(
      {
        distributor_id: distributorId,
        items: [{ product_id: productId, quantity: 5, cost_price: 20 }],
      },
      userId
    );

    const draft = await purchaseOrdersService.findById(created.id);
    expect(draft?.status).toBe('Draft');

    const sent = await purchaseOrdersService.updateStatus(created.id, 'Sent');
    expect(sent).toMatchObject({ id: created.id, status: 'Sent' });
    expect((await purchaseOrdersService.findById(created.id))?.status).toBe('Sent');

    const items = await purchaseOrdersService.getRepository().findItemsByPoId(created.id);
    const itemId = items[0].id;

    const partialStatus = await purchaseOrdersService.receiveItems(
      created.id,
      { items: [{ item_id: itemId, quantity: 2 }] },
      userId
    );
    expect(partialStatus).toBe('Partially Received');
    expect(await stockOf(productId)).toBe(2);

    const adjustments = await harness.pool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM stock_adjustments WHERE product_id = $1',
      [productId]
    );
    expect(adjustments.rows[0].n).toBe(1);

    const receivedItem = await harness.pool.query<{ received_quantity: number }>(
      'SELECT received_quantity FROM purchase_order_items WHERE id = $1',
      [itemId]
    );
    expect(Number(receivedItem.rows[0].received_quantity)).toBe(2);

    const finalStatus = await purchaseOrdersService.receiveItems(
      created.id,
      { items: [{ item_id: itemId, quantity: 3 }] },
      userId
    );
    expect(finalStatus).toBe('Received');
    expect(await stockOf(productId)).toBe(5);
  });

  it('rejects a status value outside the five with a database CHECK, and the controller maps it to a typed CONFLICT rather than a 500', async () => {
    const created = await purchaseOrdersService.create(
      {
        distributor_id: distributorId,
        items: [{ product_id: productId, quantity: 1, cost_price: 10 }],
      },
      userId
    );

    // Bypassing Zod (the controller never accepts this value) to reach the CHECK directly.
    await expect(
      purchaseOrdersService.getRepository().updateStatus(created.id, 'Bogus')
    ).rejects.toMatchObject({ code: '23514', constraint: 'purchase_orders_status_check' });

    const spy = vi.spyOn(purchaseOrdersService, 'updateStatus').mockRejectedValue(
      Object.assign(new Error('check violation'), {
        code: '23514',
        constraint: 'purchase_orders_status_check',
      })
    );

    const captured: CapturedResponse = { status: null, body: undefined };
    const res = {
      status(code: number) {
        captured.status = code;
        return this;
      },
      json(payload: unknown) {
        captured.body = payload;
        return this;
      },
    } as unknown as Response;
    let error: unknown = null;
    const next = ((err: unknown) => {
      error = err;
    }) as NextFunction;

    await new PurchaseOrdersController().updateStatus(
      { params: { id: String(created.id) }, body: { status: 'Sent' } } as unknown as Request,
      res,
      next
    );

    expect(error).toMatchObject({ name: 'PublicError', code: 'CONFLICT' });
    spy.mockRestore();
  });

  // --- Which transitions are legal by hand (#142) -------------------------------------
  //
  // 010 made all five statuses writable but could not say which moves are legal: a CHECK
  // sees the new value and never where the row came from.

  async function draftOrder(): Promise<number> {
    const created = await purchaseOrdersService.create(
      {
        distributor_id: distributorId,
        items: [{ product_id: productId, quantity: 4, cost_price: 10 }],
      },
      userId
    );
    return created.id;
  }

  it('refuses to move a Received order back to Draft', async () => {
    // The issue's repro: the stock has already moved, so there is nothing sensible for
    // a Draft order to mean afterwards.
    const id = await draftOrder();
    await purchaseOrdersService.updateStatus(id, 'Sent');
    const items = await purchaseOrdersService.getRepository().findItemsByPoId(id);
    await purchaseOrdersService.receiveItems(
      id,
      { items: [{ item_id: items[0].id, quantity: 4 }] },
      userId
    );
    expect((await purchaseOrdersService.findById(id))?.status).toBe('Received');

    await expect(purchaseOrdersService.updateStatus(id, 'Draft')).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    // Refused, not partially applied.
    expect((await purchaseOrdersService.findById(id))?.status).toBe('Received');
    expect(await stockOf(productId)).toBe(4);
  });

  it('refuses to move a Cancelled order anywhere', async () => {
    const id = await draftOrder();
    await purchaseOrdersService.updateStatus(id, 'Cancelled');

    await expect(purchaseOrdersService.updateStatus(id, 'Sent')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(purchaseOrdersService.updateStatus(id, 'Received')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect((await purchaseOrdersService.findById(id))?.status).toBe('Cancelled');
  });

  it('never lets Partially Received be set by hand', async () => {
    // It is derived from what actually arrived, so naming it by hand is a claim about
    // receipts that did not happen.
    const id = await draftOrder();
    await expect(
      purchaseOrdersService.updateStatus(id, 'Partially Received')
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await purchaseOrdersService.updateStatus(id, 'Sent');
    await expect(
      purchaseOrdersService.updateStatus(id, 'Partially Received')
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect((await purchaseOrdersService.findById(id))?.status).toBe('Sent');
  });

  it('still lets receiveItems write Partially Received, which the guard sits above', async () => {
    const id = await draftOrder();
    await purchaseOrdersService.updateStatus(id, 'Sent');
    const items = await purchaseOrdersService.getRepository().findItemsByPoId(id);

    const status = await purchaseOrdersService.receiveItems(
      id,
      { items: [{ item_id: items[0].id, quantity: 1 }] },
      userId
    );

    expect(status).toBe('Partially Received');
  });

  it('accepts re-asserting the current status as a no-op', async () => {
    // A retried request must not fail where the first one succeeded.
    const id = await draftOrder();
    await purchaseOrdersService.updateStatus(id, 'Sent');

    await expect(purchaseOrdersService.updateStatus(id, 'Sent')).resolves.toMatchObject({
      status: 'Sent',
    });
    expect((await purchaseOrdersService.findById(id))?.status).toBe('Sent');
  });

  it('keeps Sent -> Received legal, and it still moves no stock', async () => {
    // The path for goods reconciled outside the system. The request contract already
    // says setting a status does not move stock; this pins that it stays true.
    const id = await draftOrder();
    await purchaseOrdersService.updateStatus(id, 'Sent');

    await expect(purchaseOrdersService.updateStatus(id, 'Received')).resolves.toMatchObject({
      status: 'Received',
    });
    expect(await stockOf(productId)).toBe(0);
  });

  it('lets a partially received order be cancelled or completed', async () => {
    const id = await draftOrder();
    await purchaseOrdersService.updateStatus(id, 'Sent');
    const items = await purchaseOrdersService.getRepository().findItemsByPoId(id);
    await purchaseOrdersService.receiveItems(
      id,
      { items: [{ item_id: items[0].id, quantity: 1 }] },
      userId
    );

    await expect(purchaseOrdersService.updateStatus(id, 'Cancelled')).resolves.toMatchObject({
      status: 'Cancelled',
    });
    // The unit already received stays received; cancelling does not reverse it.
    expect(await stockOf(productId)).toBe(1);
  });
});
