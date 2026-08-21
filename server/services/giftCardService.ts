import {
  giftCardsService,
  generateGiftCardCode,
  GiftCardFilters,
  GiftCardListResult,
  CreateGiftCardInput,
  GiftCardBalanceResult,
  RedeemResult,
} from '../src/modules/commerce/giftCards';

export {
  GiftCardFilters,
  GiftCardListResult,
  CreateGiftCardInput,
  GiftCardBalanceResult,
  RedeemResult,
  generateGiftCardCode,
};

export async function generateGiftCardBarcode(): Promise<string> {
  return giftCardsService.generateGiftCardBarcode();
}

export async function listGiftCards(filters: GiftCardFilters): Promise<GiftCardListResult> {
  return giftCardsService.list(filters);
}

export async function createGiftCard(
  data: CreateGiftCardInput,
  createdByUserId: number
): Promise<Record<string, any>> {
  return giftCardsService.create(data, createdByUserId);
}

export async function getGiftCardBalance(code: string): Promise<GiftCardBalanceResult | null> {
  return giftCardsService.getBalance(code);
}

export async function redeemGiftCard(
  code: string,
  amount: number,
  saleId: number,
  performedByUserId: number
): Promise<RedeemResult> {
  return giftCardsService.redeem(code, amount, saleId, performedByUserId);
}

export async function getGiftCardTransactions(
  id: number
): Promise<{ card: Record<string, any> | null; transactions: Record<string, any>[] }> {
  return giftCardsService.getTransactions(id);
}

export async function updateGiftCardStatus(
  id: number | string,
  status: string
): Promise<Record<string, any> | null> {
  return giftCardsService.updateStatus(id, status);
}
