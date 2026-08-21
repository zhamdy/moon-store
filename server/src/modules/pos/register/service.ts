import { IRegisterRepository, registerRepository as defaultRepo } from './repository';
import {
  SessionRow,
  MovementRow,
  SessionReport,
  SessionHistoryFilters,
  SessionHistoryResult,
  MovementSummary,
} from './types';

export interface IRegisterService {
  getCurrentSession(userId: number): Promise<SessionRow | null>;
  openSession(
    userId: number,
    openingFloat: number
  ): Promise<{ session: SessionRow; error?: undefined } | { session?: undefined; error: string }>;
  addMovement(
    userId: number,
    type: 'cash_in' | 'cash_out',
    amount: number,
    note?: string
  ): Promise<{ movement: MovementRow; error?: undefined } | { movement?: undefined; error: string }>;
  closeSession(
    userId: number,
    countedCash: number,
    notes?: string
  ): Promise<{ session: SessionRow; error?: undefined } | { session?: undefined; error: string }>;
  getSessionReport(
    sessionId: number | string
  ): Promise<{ report: SessionReport; error?: undefined } | { report?: undefined; error: string }>;
  getSessionHistory(filters: SessionHistoryFilters): Promise<SessionHistoryResult>;
  forceCloseSession(
    sessionId: number | string
  ): Promise<{ session: SessionRow; error?: undefined } | { session?: undefined; error: string }>;
  recordSaleMovement(cashierId: number, saleId: number, cashAmount: number): Promise<void>;
  recordRefundMovement(cashierId: number, amount: number): Promise<void>;
}

export class RegisterService implements IRegisterService {
  constructor(private repo: IRegisterRepository = defaultRepo) {}

  getRepository(): IRegisterRepository {
    return this.repo;
  }

  async getCurrentSession(userId: number): Promise<SessionRow | null> {
    return this.repo.getCurrentSession(userId);
  }

  async openSession(
    userId: number,
    openingFloat: number
  ): Promise<{ session: SessionRow; error?: undefined } | { session?: undefined; error: string }> {
    const existing = await this.repo.findOpenSessionByCashierId(userId);
    if (existing) {
      return { error: 'You already have an open register session' };
    }

    const session = await this.repo.createSession(userId, openingFloat);
    return { session };
  }

  async addMovement(
    userId: number,
    type: 'cash_in' | 'cash_out',
    amount: number,
    note?: string
  ): Promise<{ movement: MovementRow; error?: undefined } | { movement?: undefined; error: string }> {
    const session = await this.repo.findOpenSessionByCashierId(userId);
    if (!session) {
      return { error: 'No open register session' };
    }

    const sessionId = session.id;
    const movement = await this.repo.createMovement(sessionId, type, amount, note);
    const delta = type === 'cash_in' ? amount : -amount;
    await this.repo.updateSessionExpectedCash(sessionId, delta);

    return { movement };
  }

  async closeSession(
    userId: number,
    countedCash: number,
    notes?: string
  ): Promise<{ session: SessionRow; error?: undefined } | { session?: undefined; error: string }> {
    const session = await this.repo.findOpenSessionByCashierId(userId);
    if (!session) {
      return { error: 'No open register session' };
    }

    const sessionId = session.id;
    const expectedCash = Number(session.expected_cash);
    const variance = countedCash - expectedCash;

    const closed = await this.repo.closeSession(sessionId, countedCash, variance, notes);
    return { session: closed };
  }

  async getSessionReport(
    sessionId: number | string
  ): Promise<{ report: SessionReport; error?: undefined } | { report?: undefined; error: string }> {
    const session = await this.repo.findSessionById(sessionId);
    if (!session) {
      return { error: 'Session not found' };
    }

    const movements = await this.repo.findMovementsBySessionId(sessionId);

    const summary: MovementSummary = {
      total_sales: 0,
      total_refunds: 0,
      total_cash_in: 0,
      total_cash_out: 0,
      sale_count: 0,
      refund_count: 0,
    };

    for (const m of movements) {
      const amt = Number(m.amount);
      switch (m.type) {
        case 'sale':
          summary.total_sales += amt;
          summary.sale_count++;
          break;
        case 'refund':
          summary.total_refunds += amt;
          summary.refund_count++;
          break;
        case 'cash_in':
          summary.total_cash_in += amt;
          break;
        case 'cash_out':
          summary.total_cash_out += amt;
          break;
      }
    }

    return {
      report: {
        session,
        movements,
        summary,
      },
    };
  }

  async getSessionHistory(filters: SessionHistoryFilters): Promise<SessionHistoryResult> {
    return this.repo.listSessionHistory(filters);
  }

  async forceCloseSession(
    sessionId: number | string
  ): Promise<{ session: SessionRow; error?: undefined } | { session?: undefined; error: string }> {
    const session = await this.repo.forceCloseSession(sessionId);
    if (!session) {
      return { error: 'No open session found' };
    }

    return { session };
  }

  async recordSaleMovement(
    cashierId: number,
    saleId: number,
    cashAmount: number
  ): Promise<void> {
    try {
      const session = await this.repo.findOpenSessionByCashierId(cashierId);
      if (!session) return;

      const sessionId = session.id;
      await this.repo.createMovement(sessionId, 'sale', cashAmount, null, saleId);
      await this.repo.updateSessionExpectedCash(sessionId, cashAmount);
      await this.repo.updateSaleRegisterSession(saleId, sessionId);
    } catch {
      // Don't fail the sale if register tracking fails
    }
  }

  async recordRefundMovement(cashierId: number, amount: number): Promise<void> {
    try {
      const session = await this.repo.findOpenSessionByCashierId(cashierId);
      if (!session) return;

      const sessionId = session.id;
      await this.repo.createMovement(sessionId, 'refund', amount);
      await this.repo.updateSessionExpectedCash(sessionId, -amount);
    } catch {
      // Don't fail the refund if register tracking fails
    }
  }
}

export const registerService = new RegisterService();

// Standalone functions for backward compatibility
export const getCurrentSession = (userId: number) => registerService.getCurrentSession(userId);
export const openSession = (userId: number, openingFloat: number) =>
  registerService.openSession(userId, openingFloat);
export const addMovement = (
  userId: number,
  type: 'cash_in' | 'cash_out',
  amount: number,
  note?: string
) => registerService.addMovement(userId, type, amount, note);
export const closeSession = (userId: number, countedCash: number, notes?: string) =>
  registerService.closeSession(userId, countedCash, notes);
export const getSessionReport = (sessionId: number | string) =>
  registerService.getSessionReport(sessionId);
export const getSessionHistory = (filters: SessionHistoryFilters) =>
  registerService.getSessionHistory(filters);
export const forceCloseSession = (sessionId: number | string) =>
  registerService.forceCloseSession(sessionId);
export const recordSaleMovement = (cashierId: number, saleId: number, cashAmount: number) =>
  registerService.recordSaleMovement(cashierId, saleId, cashAmount);
export const recordRefundMovement = (cashierId: number, amount: number) =>
  registerService.recordRefundMovement(cashierId, amount);
