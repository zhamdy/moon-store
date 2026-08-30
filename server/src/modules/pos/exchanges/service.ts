import { Queryable, withTransaction } from '../../../database/transaction';
import { IExchangesRepository, exchangesRepository as defaultRepo } from './repository';
import { CreateExchangeDTO, ExchangeFilters, ExchangeRow, ExchangeDetail } from './types';

/** A new exchange line could not be taken out of stock. Rolls the whole exchange back. */
export class ExchangeStockError extends Error {
  constructor(
    message: string,
    public readonly productId: number,
    public readonly variantId: number | null
  ) {
    super(message);
    this.name = 'ExchangeStockError';
  }
}

/**
 * Canonical order for the stock write phase: products before variants, then ascending by
 * id — the same ordering the checkout path uses, so an exchange and a sale touching the
 * same rows cannot lock them in opposite orders and deadlock.
 */
function sortForStockWrites<T extends { product_id: number; variant_id?: number | null }>(
  lines: T[]
): T[] {
  return [...lines].sort((a, b) => {
    const aVariant = a.variant_id ?? 0;
    const bVariant = b.variant_id ?? 0;
    if (aVariant !== bVariant) {
      return aVariant - bVariant;
    }
    return a.product_id - b.product_id;
  });
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
    const originalSale = await this.repo.findSaleById(data.original_sale_id);
    if (!originalSale) {
      throw new Error('Original sale not found');
    }

    if (client) {
      return this.writeExchange(data, cashierId, originalSale, client);
    }
    return withTransaction((tx) => this.writeExchange(data, cashierId, originalSale, tx));
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

    // Both loops walk the canonical order rather than the request's, so two concurrent
    // exchanges naming the same rows in opposite order cannot deadlock against each other.
    for (const item of sortForStockWrites(data.returned_items)) {
      await this.repo.createReturnedItem(exchange.id, item, client);

      if (item.condition === 'good') {
        if (item.variant_id) {
          await this.repo.restockVariant(item.variant_id, item.quantity, client);
        } else {
          await this.repo.restockProduct(item.product_id, item.quantity, client);
        }
      }
    }

    for (const item of sortForStockWrites(data.new_items)) {
      await this.repo.createNewItem(exchange.id, item, client);

      const remaining = item.variant_id
        ? await this.repo.deductVariantStock(item.variant_id, item.quantity, client)
        : await this.repo.deductProductStock(item.product_id, item.quantity, client);

      if (remaining === null) {
        // The guarded UPDATE matched nothing: not enough stock, or the row is gone.
        // Throwing rolls the whole exchange back, so no returned-item restock survives.
        throw new ExchangeStockError(
          item.variant_id
            ? `Insufficient stock for variant ID ${item.variant_id}`
            : `Insufficient stock for product ID ${item.product_id}`,
          item.product_id,
          item.variant_id ?? null
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
