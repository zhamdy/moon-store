import { withTransaction } from '../../../database/transaction';
import { withDocumentNumber } from '../../../database/documentNumber';
import { sortForStockWrites } from '../stockWriteOrder';
import { ILayawayRepository, layawayRepository as defaultRepo } from './repository';
import {
  CreateLayawayDTO,
  InstallmentDTO,
  LayawayFilters,
  LayawayPlanRow,
  LayawayPlanDetail,
} from './types';
import { PublicError } from '../../../http/errors';

export function generatePlanNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `LAY-${y}${m}${d}-${rand}`;
}

export interface ILayawayService {
  createPlan(data: CreateLayawayDTO, userId: number): Promise<LayawayPlanRow>;
  listPlans(filters: LayawayFilters): Promise<{ rows: LayawayPlanRow[]; total: number }>;
  getPlanById(id: number | string): Promise<LayawayPlanDetail | null>;
  recordPayment(
    planId: number,
    data: InstallmentDTO,
    cashierId: number,
    clientOrPool?: Parameters<typeof withTransaction>[1]
  ): Promise<{ remaining_balance: number; status: string }>;
  cancelPlan(planId: number): Promise<{ status: string }>;
}

export class LayawayService implements ILayawayService {
  constructor(
    private repo: ILayawayRepository = defaultRepo,
    /** Injected so a test can hand it a number it knows is taken; see OnlineOrdersService. */
    private generateNumber: () => string = generatePlanNumber
  ) {}

  getRepository(): ILayawayRepository {
    return this.repo;
  }

  async createPlan(data: CreateLayawayDTO, userId: number): Promise<LayawayPlanRow> {
    if (data.deposit_amount >= data.total_amount) {
      throw new PublicError('VALIDATION_ERROR', 'Deposit cannot equal or exceed total amount');
    }

    const remainingBalance = data.total_amount - data.deposit_amount;

    // Retried as a whole transaction on a plan-number collision; see `withDocumentNumber`.
    return withDocumentNumber(
      {
        generate: this.generateNumber,
        constraint: 'layaway_plans_plan_number_key',
        label: 'layaway plan',
      },
      (planNumber) =>
        withTransaction(async (client) => {
          const plan = await this.repo.createPlan(
            {
              plan_number: planNumber,
              customer_id: data.customer_id,
              total_amount: data.total_amount,
              deposit_amount: data.deposit_amount,
              remaining_balance: remainingBalance,
              due_date: data.due_date,
              notes: data.notes || null,
              created_by: userId,
            },
            client
          );

          for (const item of data.items) {
            await this.repo.createPlanItem(plan.id, item, client);
          }

          // Stock writes in the one canonical order every path in this repo uses.
          // Request order would let two plans naming the same products in opposite
          // order take their row locks in opposite order and deadlock -- SQLSTATE
          // 40P01, which reaches the caller as exactly the 500 this issue is about.
          for (const item of sortForStockWrites(data.items)) {
            // Guarded on both sides, so a plan for more units than exist is a typed
            // refusal rather than negative stock or an unmapped CHECK violation.
            const remaining = item.variant_id
              ? await this.repo.deductVariantStock(item.variant_id, item.quantity, client)
              : await this.repo.deductProductStock(item.product_id, item.quantity, client);

            if (remaining === null) {
              const available = item.variant_id
                ? await this.repo.getVariantStock(item.variant_id, client)
                : await this.repo.getProductStock(item.product_id, client);
              throw new PublicError(
                'CONFLICT',
                available === null
                  ? `Product not found: ID ${item.product_id}`
                  : `Only ${available} left of product ${item.product_id}`
              );
            }
          }

          await this.repo.createPayment(
            {
              plan_id: plan.id,
              amount: data.deposit_amount,
              payment_method: data.payment_method || 'cash',
              notes: 'Initial deposit',
              cashier_id: userId,
            },
            client
          );

          return plan;
        })
    );
  }

  async listPlans(filters: LayawayFilters): Promise<{ rows: LayawayPlanRow[]; total: number }> {
    return this.repo.listPlans(filters);
  }

  async getPlanById(id: number | string): Promise<LayawayPlanDetail | null> {
    const plan = await this.repo.findById(id);
    if (!plan) {
      return null;
    }

    const items = await this.repo.findItemsByPlanId(id);
    const payments = await this.repo.findPaymentsByPlanId(id);

    return {
      ...plan,
      items,
      payments,
    };
  }

  async recordPayment(
    planId: number,
    data: InstallmentDTO,
    cashierId: number,
    /** When the caller already owns a transaction (idempotency), run inside it. */
    clientOrPool?: Parameters<typeof withTransaction>[1]
  ): Promise<{ remaining_balance: number; status: string }> {
    const plan = await this.repo.findById(planId);
    if (!plan) {
      throw new PublicError('NOT_FOUND', 'Plan not found');
    }
    if (plan.status !== 'active') {
      throw new PublicError('CONFLICT', 'Plan is not active');
    }

    // The reads above are a courtesy that produces a better message; they are NOT what
    // makes this safe. The balance moves by one guarded relative statement inside the
    // transaction below, so two installments cannot both act on the same stale figure.
    const remaining = Number(plan.remaining_balance);
    if (data.amount > remaining) {
      throw new PublicError(
        'VALIDATION_ERROR',
        `Payment amount exceeds remaining balance of ${remaining}`
      );
    }

    return withTransaction(async (client) => {
      const newRemaining = await this.repo.decrementPlanBalance(planId, data.amount, client);
      if (newRemaining === null) {
        // The statement refused: the plan is no longer active, or no longer owes this
        // much. Re-read to say which, since the UPDATE cannot tell us.
        const current = await this.repo.findById(planId, client);
        throw current && current.status !== 'active'
          ? new PublicError('CONFLICT', 'Plan is not active')
          : new PublicError(
              'VALIDATION_ERROR',
              `Payment amount exceeds remaining balance of ${Number(current?.remaining_balance ?? 0)}`
            );
      }

      await this.repo.createPayment(
        {
          plan_id: planId,
          amount: data.amount,
          payment_method: data.payment_method || 'cash',
          notes: data.notes || null,
          cashier_id: cashierId,
        },
        client
      );

      // Derived from the balance the database returned, never from the pre-read: with
      // two installments in flight, only the winner of each statement knows what the
      // plan actually owes afterwards.
      const newStatus = newRemaining <= 0 ? 'completed' : 'active';
      if (newStatus !== 'active') {
        await this.repo.updatePlanStatus(planId, newStatus, client);
      }

      return { remaining_balance: newRemaining, status: newStatus };
    }, clientOrPool);
  }

  async cancelPlan(planId: number): Promise<{ status: string }> {
    const plan = await this.repo.findById(planId);
    if (!plan) {
      throw new PublicError('NOT_FOUND', 'Plan not found');
    }
    if (plan.status !== 'active') {
      throw new PublicError('CONFLICT', 'Only active plans can be cancelled');
    }

    return withTransaction(async (client) => {
      // Claim the cancellation FIRST, with the active check in the statement itself. A
      // cancel racing an installment used to be decided by whichever read the row first,
      // so both could proceed -- restocking goods for a plan that was being paid off, or
      // booking a payment against a plan that had just been cancelled.
      const cancelled = await this.repo.cancelActivePlan(planId, client);
      if (!cancelled) {
        throw new PublicError('CONFLICT', 'Only active plans can be cancelled');
      }

      const items = await this.repo.findItemsByPlanId(planId, client);
      for (const item of items) {
        if (item.variant_id) {
          await this.repo.restockVariant(item.variant_id, item.quantity, client);
        } else {
          await this.repo.restockProduct(item.product_id, item.quantity, client);
        }
      }

      return { status: 'cancelled' };
    });
  }
}

export const layawayService = new LayawayService();
