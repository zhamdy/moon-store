import { withTransaction } from '../../../database/transaction';
import { ILayawayRepository, layawayRepository as defaultRepo } from './repository';
import {
  CreateLayawayDTO,
  InstallmentDTO,
  LayawayFilters,
  LayawayPlanRow,
  LayawayPlanDetail,
} from './types';

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
    cashierId: number
  ): Promise<{ remaining_balance: number; status: string }>;
  cancelPlan(planId: number): Promise<{ status: string }>;
}

export class LayawayService implements ILayawayService {
  constructor(private repo: ILayawayRepository = defaultRepo) {}

  getRepository(): ILayawayRepository {
    return this.repo;
  }

  async createPlan(data: CreateLayawayDTO, userId: number): Promise<LayawayPlanRow> {
    if (data.deposit_amount >= data.total_amount) {
      throw new Error('Deposit cannot equal or exceed total amount');
    }

    const planNumber = generatePlanNumber();
    const remainingBalance = data.total_amount - data.deposit_amount;

    return withTransaction(async (client) => {
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

        if (item.variant_id) {
          await this.repo.deductVariantStock(item.variant_id, item.quantity, client);
        } else {
          await this.repo.deductProductStock(item.product_id, item.quantity, client);
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
    });
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
    cashierId: number
  ): Promise<{ remaining_balance: number; status: string }> {
    const plan = await this.repo.findById(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }
    if (plan.status !== 'active') {
      throw new Error('Plan is not active');
    }

    const remaining = Number(plan.remaining_balance);
    if (data.amount > remaining) {
      throw new Error(`Payment amount exceeds remaining balance of ${remaining}`);
    }

    const newRemaining = remaining - data.amount;
    const isCompleted = newRemaining <= 0;
    const newStatus = isCompleted ? 'completed' : 'active';

    await withTransaction(async (client) => {
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

      await this.repo.updatePlanBalance(planId, newRemaining, newStatus, client);
    });

    return {
      remaining_balance: newRemaining,
      status: newStatus,
    };
  }

  async cancelPlan(planId: number): Promise<{ status: string }> {
    const plan = await this.repo.findById(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }
    if (plan.status !== 'active') {
      throw new Error('Only active plans can be cancelled');
    }

    await withTransaction(async (client) => {
      const items = await this.repo.findItemsByPlanId(planId, client);
      for (const item of items) {
        if (item.variant_id) {
          await this.repo.restockVariant(item.variant_id, item.quantity, client);
        } else {
          await this.repo.restockProduct(item.product_id, item.quantity, client);
        }
      }

      await this.repo.updatePlanStatus(planId, 'cancelled', client);
    });

    return { status: 'cancelled' };
  }
}

export const layawayService = new LayawayService();
