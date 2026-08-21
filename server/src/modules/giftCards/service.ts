import {
  listGiftCards,
  createGiftCard,
  getGiftCardBalance,
  redeemGiftCard,
  getGiftCardTransactions,
  updateGiftCardStatus,
  generateGiftCardCode,
  generateGiftCardBarcode,
} from '../../../services/giftCardService';
import { IGiftCardsRepository, giftCardsRepository as defaultRepo } from './repository';
import { GiftCardFilters, CreateGiftCardDTO } from './types';

export class GiftCardsService {
  constructor(private repo: IGiftCardsRepository = defaultRepo) {}

  getRepository(): IGiftCardsRepository {
    return this.repo;
  }

  generateGiftCardCode() {
    return generateGiftCardCode();
  }

  generateGiftCardBarcode() {
    return generateGiftCardBarcode();
  }

  listGiftCards(filters: GiftCardFilters) {
    return listGiftCards(filters);
  }

  createGiftCard(data: CreateGiftCardDTO, createdByUserId: number) {
    return createGiftCard(data, createdByUserId);
  }

  getGiftCardBalance(code: string) {
    return getGiftCardBalance(code);
  }

  redeemGiftCard(code: string, amount: number, saleId: number, performedByUserId: number) {
    return redeemGiftCard(code, amount, saleId, performedByUserId);
  }

  getGiftCardTransactions(id: number) {
    return getGiftCardTransactions(id);
  }

  updateGiftCardStatus(id: number | string, status: string) {
    return updateGiftCardStatus(id, status);
  }
}

export const giftCardsService = new GiftCardsService();
