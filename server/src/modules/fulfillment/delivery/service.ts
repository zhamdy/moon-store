import { withTransaction, Queryable } from '../../../database/transaction';
import { sendSMS, sendWhatsApp } from '../../../../services/twilio';
import { IDeliveryRepository, deliveryRepository as defaultRepo } from './repository';
import {
  DeliveryOrderFilters,
  DeliveryOrderInput,
  StatusUpdateInput,
  DeliveryListResult,
  PerformanceResult,
} from './types';

export function generateDeliveryOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `DEL-${y}${m}${d}-${rand}`;
}

export function resolveEstimatedDelivery(estimated_delivery?: string | null): string {
  if (estimated_delivery) return estimated_delivery;
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 16);
}

export class DeliveryService {
  constructor(private repo: IDeliveryRepository = defaultRepo) {}

  getRepository(): IDeliveryRepository {
    return this.repo;
  }

  private async resolveCustomer(
    queryable: Queryable,
    customer_id: number | null | undefined,
    customer_name: string,
    phone: string,
    address?: string
  ): Promise<number> {
    if (customer_id) {
      const existing = await this.repo.findCustomerById(customer_id, queryable);
      if (!existing) {
        throw new Error('Customer not found');
      }
      return customer_id;
    }

    const newCustomer = await this.repo.createCustomer(
      customer_name,
      phone,
      address || null,
      queryable
    );
    return newCustomer.id;
  }

  async getDeliveryOrders(filters: DeliveryOrderFilters): Promise<DeliveryListResult> {
    return this.repo.list(filters);
  }

  async getDeliveryPerformance(): Promise<PerformanceResult> {
    return this.repo.getPerformance();
  }

  async getDeliveryOrder(id: string | number): Promise<Record<string, any> | null> {
    return this.repo.findById(id);
  }

  async createDeliveryOrder(data: DeliveryOrderInput): Promise<Record<string, any>> {
    const order_number = generateDeliveryOrderNumber();
    const resolvedEstimatedDelivery = resolveEstimatedDelivery(data.estimated_delivery);

    return withTransaction(async (client) => {
      const resolvedCustomerId = await this.resolveCustomer(
        client,
        data.customer_id,
        data.customer_name,
        data.phone,
        data.address
      );

      const order = await this.repo.createOrder(
        order_number,
        resolvedCustomerId,
        resolvedEstimatedDelivery,
        data,
        client
      );

      if (data.items && data.items.length > 0) {
        await this.repo.createOrderItems(order.id, data.items, client);
      }

      return order;
    });
  }

  async updateDeliveryOrder(
    id: string | number,
    data: DeliveryOrderInput
  ): Promise<Record<string, any>> {
    return withTransaction(async (client) => {
      const resolvedCustomerId = await this.resolveCustomer(
        client,
        data.customer_id,
        data.customer_name,
        data.phone,
        data.address
      );

      const order = await this.repo.updateOrder(id, resolvedCustomerId, data, client);
      if (!order) {
        throw new Error('Order not found');
      }

      await this.repo.deleteOrderItems(id, client);
      if (data.items && data.items.length > 0) {
        await this.repo.createOrderItems(id, data.items, client);
      }

      return order;
    });
  }

  async updateDeliveryStatus(
    id: string | number,
    input: StatusUpdateInput,
    userId: number
  ): Promise<Record<string, any> | null> {
    const { status, notes } = input;

    const order = await this.repo.updateStatus(id, status);
    if (!order) {
      return null;
    }

    await this.repo.createStatusHistory(id, status, notes, userId);

    if (status === 'Shipped') {
      let companyName = '';
      if (order.shipping_company_id) {
        const name = await this.repo.getShippingCompanyName(order.shipping_company_id);
        if (name) {
          companyName = name;
        }
      }
      const trackingInfo = order.tracking_number ? ` Tracking: ${order.tracking_number}` : '';
      const viaCompany = companyName ? ` via ${companyName}` : '';
      const msg = `Hi ${order.customer_name}! 🌙 Your MOON order ${order.order_number} has been shipped${viaCompany}.${trackingInfo} Thank you!`;
      sendSMS(order.phone, msg).catch(() => {});
      sendWhatsApp(order.phone, msg).catch(() => {});
    } else if (status === 'Delivered') {
      const msg = `Hi ${order.customer_name}! Your MOON order ${order.order_number} has been delivered. Thank you for shopping with us! 🌙`;
      sendSMS(order.phone, msg).catch(() => {});
      sendWhatsApp(order.phone, msg).catch(() => {});
    }

    return order;
  }

  async getOrderStatusHistory(id: string | number): Promise<Record<string, any>[]> {
    return this.repo.getStatusHistory(id);
  }
}

export const deliveryService = new DeliveryService();
