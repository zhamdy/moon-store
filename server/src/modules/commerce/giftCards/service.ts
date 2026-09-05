import { Queryable, withTransaction } from '../../../database/transaction';
import { PublicError } from '../../../http/errors';
import { IGiftCardsRepository, giftCardsRepository as defaultRepo } from './repository';
import {
  CreateGiftCardInput,
  GiftCardBalanceResult,
  GiftCardFilters,
  GiftCardListResult,
  RedeemResult,
} from './types';

export function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segments: string[] = [];
  for (let s = 0; s < 3; s++) {
    let segment = '';
    for (let i = 0; i < 4; i++) {
      segment += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(segment);
  }
  return `GC-${segments.join('-')}`;
}

export class GiftCardsService {
  constructor(private repo: IGiftCardsRepository = defaultRepo) {}

  getRepository(): IGiftCardsRepository {
    return this.repo;
  }

  async generateGiftCardBarcode(): Promise<string> {
    const prefix = '890200';
    const maxBc = await this.repo.getMaxBarcode(prefix);

    let nextSeq: number;
    if (maxBc) {
      const seqPart = maxBc.substring(prefix.length, 12);
      nextSeq = parseInt(seqPart, 10) + 1;
    } else {
      nextSeq = 1;
    }

    const seqStr = String(nextSeq).padStart(6, '0');
    const partial = prefix + seqStr;

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(partial[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return partial + checkDigit;
  }

  async list(filters: GiftCardFilters): Promise<GiftCardListResult> {
    return this.repo.list(filters);
  }

  async findById(id: number | string): Promise<Record<string, any> | null> {
    return this.repo.findById(id);
  }

  async create(data: CreateGiftCardInput, createdByUserId: number): Promise<Record<string, any>> {
    const { code, initial_value, customer_id, expires_at } = data;

    let finalCode = code || generateGiftCardCode();
    if (!code) {
      let existing = await this.repo.findByCode(finalCode);
      let attempts = 0;
      while (existing && attempts < 10) {
        finalCode = generateGiftCardCode();
        existing = await this.repo.findByCode(finalCode);
        attempts++;
      }
    }

    const barcode = await this.generateGiftCardBarcode();

    return this.repo.create({
      code: finalCode,
      barcode,
      initial_value,
      customer_id,
      expires_at,
      created_by: createdByUserId,
    });
  }

  async getBalance(code: string): Promise<GiftCardBalanceResult | null> {
    const card = await this.repo.findByCode(code);
    if (!card) {
      return null;
    }

    const balance = Number(card.balance);
    const initialValue = Number(card.initial_value);

    let isExpired = false;
    if (card.expires_at) {
      isExpired = new Date(card.expires_at) < new Date();
    }

    return {
      code: card.code,
      balance,
      initial_value: initialValue,
      status: card.status,
      expires_at: card.expires_at,
      is_expired: isExpired,
      is_redeemable: card.status === 'active' && !isExpired && balance > 0,
    };
  }

  /**
   * @param client joins an existing transaction (the idempotency claim's) instead of
   * opening one, so the claim and the debit commit or roll back together.
   */
  async redeem(
    code: string,
    amount: number,
    saleId: number,
    performedByUserId: number,
    client?: Queryable
  ): Promise<RedeemResult> {
    if (client) {
      return this.executeRedeem(code, amount, saleId, performedByUserId, client);
    }
    return withTransaction((tx) => this.executeRedeem(code, amount, saleId, performedByUserId, tx));
  }

  private async executeRedeem(
    code: string,
    amount: number,
    saleId: number,
    performedByUserId: number,
    client: Queryable
  ): Promise<RedeemResult> {
    const card = await this.repo.findByCode(code, client);

    if (!card) {
      throw new PublicError('NOT_FOUND', 'Gift card not found');
    }

    const debited = await this.repo.redeemBalance(card.id, amount, client);

    if (!debited) {
      // The guarded UPDATE decided the card was ineligible but cannot say why. This
      // read exists only to pick the reason, in the same precedence as before.
      //
      // These carry their status as a typed code rather than a message the controller
      // string-matches (#47). The wording is unchanged, but it is no longer load-bearing:
      // renaming 'Gift card is not active' used to turn a 409 into a 500 silently.
      const current = await this.repo.findById(card.id, client);

      if (!current) {
        throw new PublicError('NOT_FOUND', 'Gift card not found');
      }
      if (current.status !== 'active') {
        throw new PublicError('CONFLICT', 'Gift card is not active');
      }
      if (current.expires_at && new Date(current.expires_at) < new Date()) {
        throw new PublicError('CONFLICT', 'Gift card has expired');
      }
      throw new PublicError(
        'CONFLICT',
        `Insufficient balance. Available: ${Number(current.balance)}`
      );
    }

    const transaction = await this.repo.createTransaction(
      {
        gift_card_id: card.id,
        sale_id: saleId,
        amount,
        balance_before: debited.balanceBefore,
        balance_after: debited.balanceAfter,
        performed_by: performedByUserId,
      },
      client
    );

    return {
      transaction,
      new_balance: debited.balanceAfter,
      code: card.code,
    };
  }

  async getTransactions(
    id: number,
    page = 1,
    pageSize = 25,
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<{
    card: Record<string, any> | null;
    transactions: Record<string, any>[];
    total: number;
  }> {
    const card = await this.repo.findById(id);
    if (!card) {
      return { card: null, transactions: [], total: 0 };
    }

    const transactions = await this.repo.getTransactions(id, page, pageSize, sortOrder);
    return { card, transactions: transactions.rows, total: transactions.total };
  }

  async updateStatus(id: number | string, status: string): Promise<Record<string, any> | null> {
    return this.repo.updateStatus(id, status);
  }
}

export const giftCardsService = new GiftCardsService();
