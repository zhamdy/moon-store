import { withTransaction } from '../../../database/transaction';
import { withDocumentNumber } from '../../../database/documentNumber';
import { PublicError } from '../../../http/errors';
import { sortForStockWrites } from '../../pos/stockWriteOrder';
import {
  IReservationsRepository,
  reservationsRepository as defaultReservations,
} from '../../pos/reservations/repository';
import { IOnlineOrdersRepository, onlineOrdersRepository as defaultRepo } from './repository';
import { CreateOnlineOrderDTO, OnlineOrderFilters, OnlineOrderRecord } from './types';

/**
 * Statuses a cancellation may still restore stock from. Once an order is `delivered` the
 * goods are with the customer, so cancelling it must not put them back on the shelf --
 * doing so invented inventory out of a data-entry correction (#125).
 */
const CANCELLABLE_STATUSES = new Set(['pending', 'processing', 'shipped']);

/**
 * What an online order reserves stock as, in `stock_reservations.source_type`.
 *
 * Distinct from the `cart` holds the POS writes, because releasing one must never take
 * the other with it: both key their `source_id` on a plain numeric id.
 */
const RESERVATION_SOURCE = 'online_order';

/**
 * How long an unprocessed order holds its stock.
 *
 * A reservation is a promise to a shopper the shop has not yet acted on, so it cannot be
 * open-ended -- an abandoned order would hold goods off the shelf forever. Two days is
 * long enough to cover a weekend before anyone looks at the queue, and short enough that
 * the hold means something. When it lapses the existing `reservation-cleanup` job removes
 * the row and the units are simply available again; the order stays `pending` and is
 * re-checked against real stock when someone processes it.
 */
const RESERVATION_MINUTES = 48 * 60;

/** Statuses whose stock has actually left `products.stock` rather than merely being held. */
const DEDUCTED_STATUSES = new Set(['processing', 'shipped', 'delivered']);

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
    private generateNumber: () => string = generateOnlineOrderNumber,
    private reservations: IReservationsRepository = defaultReservations
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

          // Availability is settled BEFORE anything else in this transaction is written.
          //
          // Not merely tidy: `online_order_items.product_id` is a foreign key, so writing
          // a line takes a FOR KEY SHARE lock on the product row. Locking the same row
          // FOR UPDATE afterwards is a lock upgrade, and two orders for one product each
          // holding KEY SHARE and each waiting to upgrade is a deadlock -- SQLSTATE
          // 40P01, reported by the three-concurrent-orders test before this moved.
          // Taking the strongest lock first gives every transaction the same lock order.
          //
          // Within the pass, rows are locked in the one canonical order every stock path
          // in this repo uses, so two shoppers naming the same products in opposite order
          // cannot deadlock against each other either.
          const held = sortForStockWrites(priced);
          for (const item of held) {
            const onHand = await this.repo.lockStockForUpdate(
              item.product_id,
              item.variant_id,
              client
            );
            if (onHand === null) {
              throw new PublicError('CONFLICT', `Product not available: ID ${item.product_id}`);
            }

            // Read after the lock, so a competing order's reservation is either committed
            // and counted here or still waiting on the lock this transaction holds.
            const reserved = await this.reservations.getReservedQuantity(
              item.product_id,
              item.variant_id,
              client
            );
            const available = onHand - reserved;
            if (item.quantity > available) {
              throw new PublicError(
                'CONFLICT',
                `Only ${Math.max(0, available)} left of ${item.name}`
              );
            }
          }

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

          // The holds themselves, now that the order has an id to hang them on. The
          // stock rows locked above are still held, so nothing can have taken the units
          // between the check and this write.
          for (const item of held) {
            await this.reservations.createReservation(
              {
                product_id: item.product_id,
                variant_id: item.variant_id ?? null,
                quantity: item.quantity,
                source_type: RESERVATION_SOURCE,
                source_id: String(order.id),
                expiryMinutes: RESERVATION_MINUTES,
              },
              client
            );
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

    // Leaving `pending` for a status the shop is actually working is where the hold
    // becomes a deduction (#137). The reservation is released and the units come off
    // `products.stock` in the same transaction, so the two can never both count.
    if (DEDUCTED_STATUSES.has(status) && !DEDUCTED_STATUSES.has(currentOrder.status)) {
      return withTransaction(async (client) => {
        const items = await this.repo.getOrderItems(id, client);

        await this.reservations.deleteBySource(RESERVATION_SOURCE, String(id), client);

        for (const item of sortForStockWrites(items)) {
          const remaining = await this.repo.deductStock(
            item.product_id,
            item.variant_id,
            item.quantity,
            client
          );
          if (remaining === null) {
            // The hold has lapsed -- `reservation-cleanup` removed it after
            // RESERVATION_MINUTES -- and the units went to someone else in the meantime.
            // Refusing is the honest answer; the order stays where it was.
            const available = await this.repo.getStock(item.product_id, item.variant_id, client);
            throw new PublicError(
              'CONFLICT',
              available === null
                ? `Product no longer available: ID ${item.product_id}`
                : `Only ${available} left of product ${item.product_id}; the hold on this order has lapsed`
            );
          }
        }

        return this.repo.updateStatus(id, status, client);
      });
    }

    // If cancelling, release whatever the order is holding -- and restore stock only if
    // it was actually deducted. A `pending` order never took its units off the shelf, so
    // "restoring" them would invent inventory; before #137 every cancel restored, and
    // cancelling a `delivered` order put units back that had already left the shop
    // (#125). Cancelling an already-cancelled order is a no-op rather than a second
    // restore.
    if (status === 'cancelled' && currentOrder.status !== 'cancelled') {
      if (!CANCELLABLE_STATUSES.has(currentOrder.status)) {
        throw new PublicError(
          'CONFLICT',
          `Cannot cancel an order that is already ${currentOrder.status}`
        );
      }

      const wasDeducted = DEDUCTED_STATUSES.has(currentOrder.status);

      return withTransaction(async (client) => {
        await this.reservations.deleteBySource(RESERVATION_SOURCE, String(id), client);

        if (wasDeducted) {
          const items = await this.repo.getOrderItems(id, client);
          for (const item of sortForStockWrites(items)) {
            await this.repo.restoreStock(item.product_id, item.variant_id, item.quantity, client);
          }
        }

        return this.repo.updateStatus(id, status, client);
      });
    }

    return this.repo.updateStatus(id, status);
  }
}

export const onlineOrdersService = new OnlineOrdersService();
