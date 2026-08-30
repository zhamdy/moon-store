import { Queryable, withTransaction } from '../../../database/transaction';
import { IExchangesRepository, exchangesRepository as defaultRepo } from './repository';
import { CreateExchangeDTO, ExchangeFilters, ExchangeRow, ExchangeDetail } from './types';
import { sortForStockWrites } from '../stockWriteOrder';
import { INSUFFICIENT_STOCK_CODE } from '../sales/types';

/**
 * A new exchange line could not be taken out of stock. Rolls the whole exchange back.
 * Carries the same code and status as the checkout path's `InsufficientStockError`: it is
 * the same event, and a client should not have to special-case it per endpoint.
 */
export class ExchangeStockError extends Error {
  constructor(
    message: string,
    public readonly productId: number,
    public readonly variantId: number | null,
    public readonly code: string = INSUFFICIENT_STOCK_CODE,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ExchangeStockError';
  }
}

export function generateExchangeNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `EXC-${y}${m}${d}-${rand}`;
}

export interface IExchangesService {
  createExchange(
    data: CreateExchangeDTO,
    cashierId: number,
    client?: Queryable
  ): Promise<ExchangeRow>;
  listExchanges(filters: ExchangeFilters): Promise<{ rows: ExchangeRow[]; total: number }>;
  getExchangeById(id: number | string): Promise<ExchangeDetail | null>;
}

export class ExchangesService implements IExchangesService {
  constructor(private repo: IExchangesRepository = defaultRepo) {}

  getRepository(): IExchangesRepository {
    return this.repo;
  }

  /**
   * @param client joins an existing transaction (the idempotency claim's) instead of
   * opening one, so the claim and the exchange commit or roll back together.
   */
  async createExchange(
    data: CreateExchangeDTO,
    cashierId: number,
    client?: Queryable
  ): Promise<ExchangeRow> {
    if (client) {
      // Read on the caller's connection, not a second one from the pool: holding two
      // connections per request halves the pool's effective capacity under load.
      const originalSale = await this.repo.findSaleById(data.original_sale_id, client);
      if (!originalSale) {
        throw new Error('Original sale not found');
      }
      return this.writeExchange(data, cashierId, originalSale, client);
    }

    return withTransaction(async (tx) => {
      const originalSale = await this.repo.findSaleById(data.original_sale_id, tx);
      if (!originalSale) {
        throw new Error('Original sale not found');
      }
      return this.writeExchange(data, cashierId, originalSale, tx);
    });
  }

  private async writeExchange(
    data: CreateExchangeDTO,
    cashierId: number,
    originalSale: Record<string, any>,
    client: Queryable
  ): Promise<ExchangeRow> {
    const returnTotal = data.returned_items.reduce((s, i) => s + i.price * i.quantity, 0);
    const newTotal = data.new_items.reduce((s, i) => s + i.price * i.quantity, 0);
    const difference = newTotal - returnTotal;

    const exchange = await this.repo.createExchange(
      {
        exchange_number: generateExchangeNumber(),
        original_sale_id: data.original_sale_id,
        customer_id: originalSale.customer_id || null,
        cashier_id: cashierId,
        return_total: returnTotal,
        new_total: newTotal,
        difference,
        payment_method: data.payment_method || (difference >= 0 ? 'cash' : 'store_credit'),
        notes: data.notes || null,
      },
      client
    );

    // Line rows first. They touch the exchange's own child tables, never a product row,
    // so their order is irrelevant to locking and can stay the request's.
    for (const item of data.returned_items) {
      await this.repo.createReturnedItem(exchange.id, item, client);
    }
    for (const item of data.new_items) {
      await this.repo.createNewItem(exchange.id, item, client);
    }

    // Stock writes second, as ONE canonically ordered pass over the union of both sides.
    // Sorting each side separately would not be enough: an exchange returning product 5
    // and taking product 2 would lock 5 then 2, while one returning 2 and taking 5 locks
    // 2 then 5 — opposite orders on the same pair, which is a deadlock. It also has to
    // agree with the checkout path, hence the shared comparator.
    const stockWrites = sortForStockWrites([
      ...data.returned_items
        // A damaged return never re-enters sellable stock.
        .filter((item) => item.condition === 'good')
        .map((item) => ({ ...item, delta: item.quantity })),
      ...data.new_items.map((item) => ({ ...item, delta: -item.quantity })),
    ]);

    for (const write of stockWrites) {
      if (write.delta > 0) {
        if (write.variant_id) {
          await this.repo.restockVariant(write.variant_id, write.delta, client);
        } else {
          await this.repo.restockProduct(write.product_id, write.delta, client);
        }
        continue;
      }

      const quantity = -write.delta;
      const remaining = write.variant_id
        ? await this.repo.deductVariantStock(write.variant_id, quantity, client)
        : await this.repo.deductProductStock(write.product_id, quantity, client);

      if (remaining === null) {
        // The guarded UPDATE matched nothing: not enough stock, or the row is gone.
        // Throwing rolls the whole exchange back, so no returned-item restock survives.
        throw new ExchangeStockError(
          write.variant_id
            ? `Insufficient stock for variant ID ${write.variant_id}`
            : `Insufficient stock for product ID ${write.product_id}`,
          write.product_id,
          write.variant_id ?? null
        );
      }
    }

    return exchange;
  }

  async listExchanges(filters: ExchangeFilters): Promise<{ rows: ExchangeRow[]; total: number }> {
    const { page, pageSize, search, sortBy, sortOrder } = filters;
    const offset = (page - 1) * pageSize;

    const result = await this.repo.listExchanges({
      search,
      sortBy,
      sortOrder,
      limit: pageSize,
      offset,
    });

    return result;
  }

  async getExchangeById(id: number | string): Promise<ExchangeDetail | null> {
    const exchange = await this.repo.findById(id);
    if (!exchange) {
      return null;
    }

    const returnedItems = await this.repo.findReturnedItems(id);
    const newItems = await this.repo.findNewItems(id);

    return {
      ...exchange,
      returned_items: returnedItems,
      new_items: newItems,
    };
  }
}

export const exchangesService = new ExchangesService();
