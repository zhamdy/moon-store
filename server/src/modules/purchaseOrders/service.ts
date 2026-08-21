import { withTransaction } from '../../database/transaction';
import { IPurchaseOrdersRepository, purchaseOrdersRepository as defaultRepo } from './repository';
import { CreatePurchaseOrderDTO, ReceivePurchaseOrderDTO, PurchaseOrderFilters } from './types';

export function generatePONumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `PO-${y}${m}${d}-${rand}`;
}

export class PurchaseOrdersService {
  constructor(private repo: IPurchaseOrdersRepository = defaultRepo) {}

  getRepository(): IPurchaseOrdersRepository {
    return this.repo;
  }

  list(filters: PurchaseOrderFilters) {
    return this.repo.list(filters);
  }

  getAutoGenerateSuggestions() {
    return this.repo.findLowStockForAutoPO();
  }

  async getOrder(id: number | string) {
    const order = await this.repo.findById(id);
    if (!order) return null;
    const items = await this.repo.findItems(id);
    return { ...order, items };
  }

  async createOrder(data: CreatePurchaseOrderDTO, userId: number) {
    const poNumber = generatePONumber();
    const total = data.items.reduce((sum, item) => sum + item.cost_price * item.quantity, 0);

    const poId = await withTransaction(async (client) => {
      const newPoId = await this.repo.createOrder(
        {
          po_number: poNumber,
          distributor_id: data.distributor_id,
          notes: data.notes || null,
          total,
          created_by: userId,
        },
        client
      );

      for (const item of data.items) {
        await this.repo.createOrderItem(
          {
            po_id: newPoId,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            quantity: item.quantity,
            cost_price: item.cost_price,
          },
          client
        );
      }

      return newPoId;
    });

    return { id: poId, po_number: poNumber };
  }

  async updateStatus(id: number | string, status: string) {
    const existing = await this.repo.findById(id);
    if (!existing) return null;
    await this.repo.updateStatus(id, status);
    return { id: Number(id), status };
  }

  async receiveOrder(id: number | string, data: ReceivePurchaseOrderDTO, userId: number) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      const err = new Error('Purchase order not found');
      (err as any).statusCode = 404;
      throw err;
    }

    if (existing.status === 'Cancelled' || existing.status === 'Received') {
      const err = new Error(`Cannot receive items for ${existing.status} order`);
      (err as any).statusCode = 400;
      throw err;
    }

    const calculatedStatus = await withTransaction(async (client) => {
      for (const receiveItem of data.items) {
        if (receiveItem.quantity <= 0) continue;

        const poItem = await this.repo.findItemById(receiveItem.item_id, id, client);
        if (!poItem) continue;

        const maxReceivable = Number(poItem.quantity) - Number(poItem.received_quantity || 0);
        const actualReceive = Math.min(receiveItem.quantity, maxReceivable);
        if (actualReceive <= 0) continue;

        await this.repo.updateReceivedQuantity(receiveItem.item_id, actualReceive, client);

        if (poItem.variant_id) {
          await this.repo.updateVariantStock(poItem.variant_id, actualReceive, client);
        }

        const newStock = await this.repo.updateProductStock(
          poItem.product_id,
          actualReceive,
          client
        );
        const prevStock = newStock - actualReceive;

        await this.repo.createStockAdjustment(
          {
            product_id: poItem.product_id,
            previous_qty: prevStock,
            new_qty: newStock,
            delta: actualReceive,
            reason: 'Import',
            user_id: userId,
          },
          client
        );
      }

      const allItems = await this.repo.getOrderItemsQuantityStatus(id, client);
      const allReceived = allItems.every((i) => Number(i.received_quantity) >= Number(i.quantity));
      const someReceived = allItems.some((i) => Number(i.received_quantity) > 0);

      let newStatus = existing.status as string;
      if (allReceived) {
        newStatus = 'Received';
      } else if (someReceived) {
        newStatus = 'Partially Received';
      }

      await this.repo.updateStatus(id, newStatus, client);
      return newStatus;
    });

    return { id: Number(id), status: calculatedStatus };
  }

  async deleteOrder(id: number | string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      const err = new Error('Purchase order not found');
      (err as any).statusCode = 404;
      throw err;
    }

    if (existing.status !== 'Draft') {
      const err = new Error('Only Draft purchase orders can be deleted');
      (err as any).statusCode = 400;
      throw err;
    }

    return this.repo.deleteOrder(id);
  }
}

export const purchaseOrdersService = new PurchaseOrdersService();
