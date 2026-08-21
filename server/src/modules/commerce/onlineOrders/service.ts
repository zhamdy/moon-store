import { withTransaction } from '../../../database/transaction';
import { IOnlineOrdersRepository, onlineOrdersRepository as defaultRepo } from './repository';
import {
  CreateOnlineOrderDTO,
  OnlineOrderFilters,
  OnlineOrderRecord,
} from './types';

export function generateOnlineOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `WEB-${y}${m}${d}-${rand}`;
}

export class OnlineOrdersService {
  constructor(private repo: IOnlineOrdersRepository = defaultRepo) {}

  getRepository(): IOnlineOrdersRepository {
    return this.repo;
  }

  async createOrder(data: CreateOnlineOrderDTO): Promise<OnlineOrderRecord> {
    const subtotal = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const shippingFee = data.shipping_fee || 0;
    const total = subtotal + shippingFee;
    const orderNumber = generateOnlineOrderNumber();

    return withTransaction(async (client) => {
      // Find or create customer
      let customerId: number | null = null;
      const custRes = await this.repo.findCustomerByPhone(data.customer_phone, client);
      if (custRes) {
        customerId = custRes.id;
      } else {
        const newCust = await this.repo.createCustomer(
          data.customer_name,
          data.customer_phone,
          `${data.shipping_address}, ${data.city}`,
          client
        );
        customerId = newCust.id;
      }

      // Create online order
      const order = await this.repo.createOrder(
        {
          order_number: orderNumber,
          customer_id: customerId,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          customer_email: data.customer_email || null,
          shipping_address: data.shipping_address,
          city: data.city,
          subtotal,
          shipping_fee: shippingFee,
          total,
          notes: data.notes || null,
        },
        client
      );

      // Insert items & reserve stock
      for (const item of data.items) {
        await this.repo.createOrderItem(
          {
            order_id: order.id,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            quantity: item.quantity,
            price: item.price,
          },
          client
        );

        await this.repo.deductStock(item.product_id, item.variant_id, item.quantity, client);
      }

      return order;
    });
  }

  async list(
    filters: OnlineOrderFilters
  ): Promise<{ rows: OnlineOrderRecord[]; total: number; page: number; limit: number }> {
    const pageNum = filters.page ? Number(filters.page) : 1;
    const limitNum = filters.limit ? Number(filters.limit) : 20;

    const result = await this.repo.list({
      ...filters,
      page: pageNum,
      limit: limitNum,
    });

    return {
      rows: result.rows,
      total: result.total,
      page: pageNum,
      limit: limitNum,
    };
  }

  async findById(id: number | string): Promise<OnlineOrderRecord | null> {
    const order = await this.repo.findById(id);
    if (!order) {
      return null;
    }

    const items = await this.repo.getOrderItems(id);
    return {
      ...order,
      items,
    };
  }

  async updateStatus(id: number | string, status: string): Promise<OnlineOrderRecord | null> {
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    const currentOrder = await this.repo.findById(id);
    if (!currentOrder) {
      return null;
    }

    // If cancelling, restore inventory
    if (status === 'cancelled' && currentOrder.status !== 'cancelled') {
      return withTransaction(async (client) => {
        const items = await this.repo.getOrderItems(id, client);
        for (const item of items) {
          await this.repo.restoreStock(item.product_id, item.variant_id, item.quantity, client);
        }
        return this.repo.updateStatus(id, status, client);
      });
    }

    return this.repo.updateStatus(id, status);
  }
}

export const onlineOrdersService = new OnlineOrdersService();
