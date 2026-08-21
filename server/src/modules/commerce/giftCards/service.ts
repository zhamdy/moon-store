import { withTransaction } from '../../../database/transaction';
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

  async create(
    data: CreateGiftCardInput,
    createdByUserId: number
  ): Promise<Record<string, any>> {
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

  async redeem(
    code: string,
    amount: number,
    saleId: number,
    performedByUserId: number
  ): Promise<RedeemResult> {
    return withTransaction(async (client) => {
      const card = await this.repo.findByCode(code, client);

      if (!card) {
        throw new Error('Gift card not found');
      }

      if (card.status !== 'active') {
        throw new Error('Gift card is not active');
      }

      if (card.expires_at && new Date(card.expires_at) < new Date()) {
        throw new Error('Gift card has expired');
      }

      const currentBalance = Number(card.balance);
      if (currentBalance < amount) {
        throw new Error(`Insufficient balance. Available: ${currentBalance}`);
      }

      const newBalance = currentBalance - amount;
      await this.repo.updateBalance(card.id, newBalance, client);

      const transaction = await this.repo.createTransaction(
        {
          gift_card_id: card.id,
          sale_id: saleId,
          amount,
          balance_before: currentBalance,
          balance_after: newBalance,
          performed_by: performedByUserId,
        },
        client
      );

      return {
        transaction,
        new_balance: newBalance,
        code: card.code,
      };
    });
  }

  async getTransactions(
    id: number
  ): Promise<{ card: Record<string, any> | null; transactions: Record<string, any>[] }> {
    const card = await this.repo.findById(id);
    if (!card) {
      return { card: null, transactions: [] };
    }

    const transactions = await this.repo.getTransactions(id);
    return { card, transactions };
  }

  async updateStatus(
    id: number | string,
    status: string
  ): Promise<Record<string, any> | null> {
    return this.repo.updateStatus(id, status);
  }
}

export const giftCardsService = new GiftCardsService();
