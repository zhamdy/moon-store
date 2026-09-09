import { withTransaction } from '../../../database/transaction';
import { withDocumentNumber } from '../../../database/documentNumber';
import { PublicError } from '../../../http/errors';
import { sortForStockWrites } from '../../pos/stockWriteOrder';
import { IOnlineOrdersRepository, onlineOrdersRepository as defaultRepo } from './repository';
import { CreateOnlineOrderDTO, OnlineOrderFilters, OnlineOrderRecord } from './types';

/**
 * Statuses a cancellation may still restore stock from. Once an order is `delivered` the
 * goods are with the customer, so cancelling it must not put them back on the shelf --
 * doing so invented inventory out of a data-entry correction (#125).
 */
const CANCELLABLE_STATUSES = new Set(['pending', 'processing', 'shipped']);

export function generateOnlineOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `WEB-${y}${m}${d}-${rand}`;
}

export class OnlineOrdersService {
  constructor(
    private repo: IOnlineOrdersRepository = defaultRepo,
    /**
     * Injected rather than called directly so a test can hand it a number it knows is
     * taken. Spying on the module export cannot work: the call site closes over the
     * local binding, not the exported property.
     */
    private generateNumber: () => string = generateOnlineOrderNumber
  ) {}

  getRepository(): IOnlineOrdersRepository {
    return this.repo;
  }

  async createOrder(data: CreateOnlineOrderDTO): Promise<OnlineOrderRecord> {
    const shippingFee = data.shipping_fee || 0;

    // Retried as a whole transaction, because a failed statement aborts the one it is
    // in; see `withDocumentNumber`.
    return withDocumentNumber(
      {
        generate: this.generateNumber,
        constraint: 'online_orders_order_number_key',
        label: 'online order number',
      },
      (orderNumber) =>
        withTransaction(async (client) => {
          // Price every line from the catalog, inside the transaction. This endpoint is
          // public and unauthenticated, and it used to bill `data.items[].price` -- the
          // shopper's own number -- so anyone could order at a price they chose (#125).
          // The request's `price` is still accepted for compatibility and ignored, the
          // same posture as checkout and refunds.
          const priced = [];
          for (const item of data.items) {
            const catalog = await this.repo.getCatalogLine(
              item.product_id,
              item.variant_id,
              client
            );
            if (!catalog) {
              throw new PublicError(
                'VALIDATION_ERROR',
                `Product not available: ID ${item.product_id}`
              );
            }
            priced.push({ ...item, price: catalog.price, name: catalog.name });
          }

          const subtotal = priced.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const total = subtotal + shippingFee;

          // Find or create customer
          let customerId: number | null = null;
          const custRes = await this.repo.findCustomerByPhone(data.customer_phone, client);
          if (custRes) {
            customerId = custRes.id;
          } else {
            const newCust = await this.repo.createCustomer(
              data.customer_name,
              data.customer_phone,
              `${data.shipping_address}, ${data.city}`,
              client
            );
            customerId = newCust.id;
          }

          const order = await this.repo.createOrder(
            {
              order_number: orderNumber,
              customer_id: customerId,
              customer_name: data.customer_name,
              customer_phone: data.customer_phone,
              customer_email: data.customer_email || null,
              shipping_address: data.shipping_address,
              city: data.city,
              subtotal,
              shipping_fee: shippingFee,
              total,
              notes: data.notes || null,
            },
            client
          );

          for (const item of priced) {
            await this.repo.createOrderItem(
              {
                order_id: order.id,
                product_id: item.product_id,
                variant_id: item.variant_id || null,
                quantity: item.quantity,
                price: item.price,
              },
              client
            );
          }

          // Stock writes in the one canonical order every path in this repo uses, and
          // in their own pass. Deducting in request order lets two shoppers who name the
          // same products in opposite order take their row locks in opposite order and
          // deadlock -- SQLSTATE 40P01, which reaches the shopper as exactly the 500
          // this issue set out to remove.
          for (const item of sortForStockWrites(priced)) {
            const remaining = await this.repo.deductStock(
              item.product_id,
              item.variant_id,
              item.quantity,
              client
            );
            if (remaining === null) {
              // The guarded write refuses on both "no such row" and "not enough"; a
              // re-read is the only way to tell a shopper which.
              const available = await this.repo.getStock(item.product_id, item.variant_id, client);
              throw new PublicError(
                'CONFLICT',
                available === null
                  ? `Product not available: ID ${item.product_id}`
                  : `Only ${available} left of ${item.name}`
              );
            }
          }

          return order;
        })
    );
  }

  async list(
    filters: OnlineOrderFilters
  ): Promise<{ rows: OnlineOrderRecord[]; total: number; page: number; limit: number }> {
    const pageNum = filters.page ? Number(filters.page) : 1;
    const limitNum = filters.pageSize;

    const result = await this.repo.list({
      ...filters,
      page: pageNum,
      pageSize: limitNum,
    });

    return {
      rows: result.rows,
      total: result.total,
      page: pageNum,
      limit: limitNum,
    };
  }

  async findById(id: number | string): Promise<OnlineOrderRecord | null> {
    const order = await this.repo.findById(id);
    if (!order) {
      return null;
    }

    const items = await this.repo.getOrderItems(id);
    return {
      ...order,
      items,
    };
  }

  async updateStatus(id: number | string, status: string): Promise<OnlineOrderRecord | null> {
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    const currentOrder = await this.repo.findById(id);
    if (!currentOrder) {
      return null;
    }

    // If cancelling, restore inventory -- but only from a status the goods could still
    // be recovered from. Cancelling a `delivered` order used to put its units back on
    // the shelf, creating stock that had already left the shop (#125). Cancelling an
    // already-cancelled order is a no-op rather than a second restore.
    if (status === 'cancelled' && currentOrder.status !== 'cancelled') {
      if (!CANCELLABLE_STATUSES.has(currentOrder.status)) {
        throw new PublicError(
          'CONFLICT',
          `Cannot cancel an order that is already ${currentOrder.status}`
        );
      }

      return withTransaction(async (client) => {
        const items = await this.repo.getOrderItems(id, client);
        for (const item of items) {
          await this.repo.restoreStock(item.product_id, item.variant_id, item.quantity, client);
        }
        return this.repo.updateStatus(id, status, client);
      });
    }

    return this.repo.updateStatus(id, status);
  }
}

export const onlineOrdersService = new OnlineOrdersService();
