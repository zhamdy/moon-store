import { CreateSaleDTO, CreateRefundDTO, SaleTotals } from '../src/modules/sales/types';
import { salesService } from '../src/modules/sales/service';
import pool from '../src/database/pool';
import { Queryable } from '../src/database/transaction';

export type CreateSaleInput = CreateSaleDTO;
export type RefundInput = CreateRefundDTO;
export type { SaleTotals };

export async function calculateSaleTotals(
  input: CreateSaleInput,
  queryable: Queryable = pool
): Promise<SaleTotals> {
  return salesService.calculateSaleTotals(input, queryable);
}

export async function executeSaleTransaction(
  input: CreateSaleInput,
  _totals: SaleTotals,
  cashierId: number,
  clientOrPool?: any
): Promise<Record<string, any>> {
  return salesService.executeSale(input, cashierId, clientOrPool);
}

export async function executeRefundTransaction(
  saleId: number,
  input: RefundInput,
  cashierId: number,
  clientOrPool?: any
): Promise<{ refund: Record<string, any>; refundStatus: string; newRefundedTotal: number }> {
  return salesService.executeRefund(saleId, input, cashierId, clientOrPool);
}
