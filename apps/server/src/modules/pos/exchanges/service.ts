import { Queryable, withTransaction } from '../../../database/transaction';
import { IExchangesRepository, exchangesRepository as defaultRepo } from './repository';
import {
  CreateExchangeDTO,
  ExchangeFilters,
  ExchangeRow,
  ExchangeDetail,
  ReturnedItemInput,
  NewItemInput,
} from './types';
import { sortForStockWrites } from '../stockWriteOrder';
import { INSUFFICIENT_STOCK_CODE, type StockConflict } from '../sales/types';
import { PublicError } from '../../../http/errors';
import {
  StoreCreditService,
  storeCreditService as defaultStoreCredit,
} from '../../commerce/storeCredit/service';

/**
 * A new exchange line could not be taken out of stock. Rolls the whole exchange back.
 * Carries the same code and status as the checkout path's `InsufficientStockError`: it is
 * the same event, and a client should not have to special-case it per endpoint.
 */
export class ExchangeStockError extends Error {
  constructor(
    message: string,
    public readonly conflicts: readonly StockConflict[],
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

/**
 * The composite key a returned line is matched and capped on: two variants of one
 * product are distinct lines, and a plain line normalizes to the empty variant.
 */
function lineKey(productId: number, variantId?: number | null): string {
  return `${productId}:${variantId ?? ''}`;
}

export class ExchangesService implements IExchangesService {
  constructor(
    private repo: IExchangesRepository = defaultRepo,
    private storeCredit: StoreCreditService = defaultStoreCredit
  ) {}

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
      // Locked, so the cumulative check below cannot race a sibling exchange or a
      // concurrent refund of the same lines (#122).
      const originalSale = await this.repo.findSaleByIdForUpdate(data.original_sale_id, client);
      if (!originalSale) {
        throw new PublicError('NOT_FOUND', 'Original sale not found');
      }
      return this.writeExchange(data, cashierId, originalSale, client);
    }

    return withTransaction(async (tx) => {
      const originalSale = await this.repo.findSaleByIdForUpdate(data.original_sale_id, tx);
      if (!originalSale) {
        throw new PublicError('NOT_FOUND', 'Original sale not found');
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
    // Nothing used to check that a returned line was ever on this sale, and the credit
    // came from `price` in the request. A cashier could hand back goods the shop never
    // sold, at a figure they chose, and the exchange both paid for them and restocked
    // them (#122). Every returned line is now resolved against the sale's own lines and
    // valued from `sale_items.unit_price`.
    const saleItems = await this.repo.findSaleItems(data.original_sale_id, client);

    // A sale can hold more than one row for the same line -- checkout writes one row per
    // request line without aggregating -- so what was sold is their sum, not the first
    // row's quantity. Reading one row would refuse a legitimate return of the rest.
    const soldByLine = new Map<string, { quantity: number; unitPrice: number }>();
    const soldByProduct = new Map<number, number>();
    for (const saleItem of saleItems) {
      const key = lineKey(saleItem.product_id, saleItem.variant_id);
      const sold = soldByLine.get(key);
      const quantity = Number(saleItem.quantity);
      soldByLine.set(key, {
        quantity: (sold?.quantity ?? 0) + quantity,
        unitPrice: Number(saleItem.unit_price),
      });
      soldByProduct.set(
        saleItem.product_id,
        (soldByProduct.get(saleItem.product_id) ?? 0) + quantity
      );
    }

    // Both recovery routes count against the same sold quantity. Capping exchanges alone
    // would leave the door open: refund a line, then exchange it, and it comes back twice.
    const alreadyTakenByLine = new Map<string, number>();
    const alreadyTakenByProduct = new Map<number, number>();
    for (const prior of [
      ...(await this.repo.findReturnedQuantitiesBySaleId(data.original_sale_id, client)),
      ...(await this.repo.findRefundedQuantitiesBySaleId(data.original_sale_id, client)),
    ]) {
      const key = lineKey(prior.product_id, prior.variant_id);
      alreadyTakenByLine.set(key, (alreadyTakenByLine.get(key) ?? 0) + prior.quantity);
      alreadyTakenByProduct.set(
        prior.product_id,
        (alreadyTakenByProduct.get(prior.product_id) ?? 0) + prior.quantity
      );
    }

    // This request's own lines, aggregated first: several entries for one line each pass
    // an individual check and together exceed what was sold.
    const requestedByLine = new Map<string, number>();
    const requestedByProduct = new Map<number, number>();
    for (const item of data.returned_items) {
      const key = lineKey(item.product_id, item.variant_id);
      requestedByLine.set(key, (requestedByLine.get(key) ?? 0) + item.quantity);
      requestedByProduct.set(
        item.product_id,
        (requestedByProduct.get(item.product_id) ?? 0) + item.quantity
      );
    }

    let returnTotal = 0;
    /** The sold price of each returned line, so the persisted rows agree with the header. */
    const pricedReturns: Array<ReturnedItemInput & { price: number }> = [];

    for (const item of data.returned_items) {
      const key = lineKey(item.product_id, item.variant_id);
      const sold = soldByLine.get(key);
      if (!sold) {
        throw new PublicError(
          'VALIDATION_ERROR',
          `Product ${item.product_id} was not sold on sale ${data.original_sale_id}`
        );
      }

      const remaining = sold.quantity - (alreadyTakenByLine.get(key) ?? 0);
      if ((requestedByLine.get(key) ?? 0) > remaining) {
        throw new PublicError(
          'VALIDATION_ERROR',
          `Return quantity exceeds what remains of product ${item.product_id} ` +
            `(${Math.max(0, remaining)} remaining)`
        );
      }

      // A second cap, on the product rather than the line. A refund recorded before
      // `variant_id` existed on a refund line is stored under the product-only key, so
      // its per-line cap above reads zero for a variant line. Summing every prior for
      // the product, whichever way it was keyed, keeps those rows counting.
      const productRemaining =
        (soldByProduct.get(item.product_id) ?? 0) -
        (alreadyTakenByProduct.get(item.product_id) ?? 0);
      if ((requestedByProduct.get(item.product_id) ?? 0) > productRemaining) {
        throw new PublicError(
          'VALIDATION_ERROR',
          `Return quantity exceeds what remains of product ${item.product_id} ` +
            `(${Math.max(0, productRemaining)} remaining)`
        );
      }

      // Valued from the sale, never from the request -- the same rule refunds and
      // checkout follow.
      returnTotal += sold.unitPrice * item.quantity;
      pricedReturns.push({ ...item, price: sold.unitPrice });
    }

    // The goods going OUT are priced from the catalog, for the same reason the ones
    // coming back are priced from the sale: `price` is the caller's number. Left
    // trusted, an exchange could take real stock out at 0.01 a unit and pay the
    // difference as store credit.
    let newTotal = 0;
    const pricedNewItems: Array<NewItemInput & { price: number }> = [];
    for (const item of data.new_items) {
      const catalog = await this.repo.getCatalogPrice(item.product_id, item.variant_id, client);
      if (catalog === null) {
        throw new PublicError('VALIDATION_ERROR', `Product not found: ID ${item.product_id}`);
      }
      newTotal += catalog * item.quantity;
      pricedNewItems.push({ ...item, price: catalog });
    }

    const difference = newTotal - returnTotal;

    // Store credit is the default when the shop ends up owing -- but only for a sale
    // with a customer on it. A walk-in has nobody to hold a balance, so defaulting to
    // credit there would mint a promise with no one to keep it to; cash is what actually
    // happens at the counter.
    const owesCustomer = difference < 0;
    const defaultMethod = owesCustomer && originalSale.customer_id ? 'store_credit' : 'cash';
    const paymentMethod = data.payment_method || defaultMethod;

    const exchange = await this.repo.createExchange(
      {
        exchange_number: generateExchangeNumber(),
        original_sale_id: data.original_sale_id,
        customer_id: originalSale.customer_id || null,
        cashier_id: cashierId,
        return_total: returnTotal,
        new_total: newTotal,
        difference,
        payment_method: paymentMethod,
        notes: data.notes || null,
      },
      client
    );

    // Credit the customer when the shop ends up owing them and store credit is how it is
    // being settled. This is the whole of #138: `store_credit` has always been the
    // DEFAULT for a negative difference, and nothing anywhere wrote a balance -- the
    // exchange recorded that the customer was owed money and then lost it.
    //
    // Issued inside the exchange's own transaction, so credit for an exchange that then
    // failed cannot survive it. A negative difference with no customer on the original
    // sale is refused rather than silently dropped: there is nobody to credit, and
    // recording the exchange anyway is how the money went missing in the first place.
    if (owesCustomer && paymentMethod === 'store_credit') {
      if (!originalSale.customer_id) {
        // Only reachable when the caller ASKED for store credit on a sale that has no
        // customer. Refusing is the honest answer: the alternative is recording that the
        // shop owes money and having nowhere to write it, which is the defect itself.
        throw new PublicError(
          'VALIDATION_ERROR',
          'This exchange owes the customer money, but the original sale has no customer to credit. Settle it as cash or card instead.'
        );
      }

      await this.storeCredit.issue(
        {
          customer_id: originalSale.customer_id,
          amount: -difference,
          reason: `Exchange ${exchange.exchange_number}`,
          source_type: 'exchange',
          source_id: String(exchange.id),
          created_by: cashierId,
        },
        client
      );
    }

    // Line rows first. They touch the exchange's own child tables, never a product row,
    // so their order is irrelevant to locking and can stay the request's.
    //
    // The PRICED lines are persisted, not the request's: a row storing a price the
    // header total does not use would contradict it, and any report summing those rows
    // would be wrong.
    for (const item of pricedReturns) {
      await this.repo.createReturnedItem(exchange.id, item, client);
    }
    for (const item of pricedNewItems) {
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

    // The net change this transaction has already made to each stock row. Read only on
    // the refusal path: every one of these writes is about to be rolled back, so they
    // have to come back out of the figure reported to the cashier. A returned item
    // restocked a moment ago is not stock they can sell on this exchange.
    const appliedSoFar = new Map<string, number>();
    const stockKeyOf = (write: { product_id: number; variant_id?: number | null }): string =>
      write.variant_id ? `v:${write.variant_id}` : `p:${write.product_id}`;

    for (const write of stockWrites) {
      const stockKey = stockKeyOf(write);

      if (write.delta > 0) {
        if (write.variant_id) {
          await this.repo.restockVariant(write.variant_id, write.delta, client);
        } else {
          await this.repo.restockProduct(write.product_id, write.delta, client);
        }
        appliedSoFar.set(stockKey, (appliedSoFar.get(stockKey) ?? 0) + write.delta);
        continue;
      }

      const quantity = -write.delta;
      const remaining = write.variant_id
        ? await this.repo.deductVariantStock(write.variant_id, quantity, client)
        : await this.repo.deductProductStock(write.product_id, quantity, client);

      if (remaining === null) {
        // The guarded UPDATE matched nothing: not enough stock, or the row is gone.
        // Throwing rolls the whole exchange back, so no returned-item restock survives.
        //
        // Read the row first: this is the only point where the true figure exists, and
        // sending it saves the client a round-trip to rediscover it.
        const current = write.variant_id
          ? await this.repo.getVariantStock(write.variant_id, client)
          : await this.repo.getProductStock(write.product_id, client);

        throw new ExchangeStockError(
          write.variant_id
            ? `Insufficient stock for variant ID ${write.variant_id}`
            : `Insufficient stock for product ID ${write.product_id}`,
          [
            {
              productId: write.product_id,
              variantId: write.variant_id ?? null,
              requested: quantity,
              // A deleted row reads as null, and is reported as zero available: for a
              // cashier, "not enough" and "gone" mean the same thing here.
              available: Math.max(0, (current ?? 0) - (appliedSoFar.get(stockKey) ?? 0)),
            },
          ]
        );
      }

      appliedSoFar.set(stockKey, (appliedSoFar.get(stockKey) ?? 0) + write.delta);
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
