import { withTransaction } from '../../../database/transaction';
import { IExchangesRepository, exchangesRepository as defaultRepo } from './repository';
import { CreateExchangeDTO, ExchangeFilters, ExchangeRow, ExchangeDetail } from './types';

export function generateExchangeNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `EXC-${y}${m}${d}-${rand}`;
}

export interface IExchangesService {
  createExchange(data: CreateExchangeDTO, cashierId: number): Promise<ExchangeRow>;
  listExchanges(filters: ExchangeFilters): Promise<{ rows: ExchangeRow[]; total: number }>;
  getExchangeById(id: number | string): Promise<ExchangeDetail | null>;
}

export class ExchangesService implements IExchangesService {
  constructor(private repo: IExchangesRepository = defaultRepo) {}

  getRepository(): IExchangesRepository {
    return this.repo;
  }

  async createExchange(data: CreateExchangeDTO, cashierId: number): Promise<ExchangeRow> {
    const originalSale = await this.repo.findSaleById(data.original_sale_id);
    if (!originalSale) {
      throw new Error('Original sale not found');
    }

    const returnTotal = data.returned_items.reduce((s, i) => s + i.price * i.quantity, 0);
    const newTotal = data.new_items.reduce((s, i) => s + i.price * i.quantity, 0);
    const difference = newTotal - returnTotal;
    const exchangeNumber = generateExchangeNumber();

    return withTransaction(async (client) => {
      const exchange = await this.repo.createExchange(
        {
          exchange_number: exchangeNumber,
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

      for (const item of data.returned_items) {
        await this.repo.createReturnedItem(exchange.id, item, client);

        if (item.condition === 'good') {
          if (item.variant_id) {
            await this.repo.restockVariant(item.variant_id, item.quantity, client);
          } else {
            await this.repo.restockProduct(item.product_id, item.quantity, client);
          }
        }
      }

      for (const item of data.new_items) {
        await this.repo.createNewItem(exchange.id, item, client);

        if (item.variant_id) {
          await this.repo.deductVariantStock(item.variant_id, item.quantity, client);
        } else {
          await this.repo.deductProductStock(item.product_id, item.quantity, client);
        }
      }

      return exchange;
    });
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
