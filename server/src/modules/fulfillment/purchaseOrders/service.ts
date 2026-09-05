import { withTransaction } from '../../../database/transaction';
import { IPurchaseOrdersRepository, purchaseOrdersRepository as defaultRepo } from './repository';
import {
  CreatePurchaseOrderDTO,
  ReceiveItemsDTO,
  PurchaseOrderFilters,
  PurchaseOrderListResult,
} from './types';
import { PublicError } from '../../../http/errors';

export function generatePONumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `PO-${y}${m}${d}-${rand}`;
}

export class PurchaseOrdersService {
  constructor(private repo: IPurchaseOrdersRepository = defaultRepo) {}

  getRepository(): IPurchaseOrdersRepository {
    return this.repo;
  }

  async list(filters: PurchaseOrderFilters): Promise<PurchaseOrderListResult> {
    return this.repo.list(filters);
  }

  async findById(id: number | string): Promise<Record<string, any> | null> {
    const order = await this.repo.findById(id);
    if (!order) {
      return null;
    }

    const items = await this.repo.findItemsByPoId(id);
    const parsedItems = items.map((item: any) => ({
      ...item,
      variant_attributes: item.variant_attributes
        ? typeof item.variant_attributes === 'string'
          ? JSON.parse(item.variant_attributes)
          : item.variant_attributes
        : null,
    }));

    return { ...order, items: parsedItems };
  }

  async create(
    data: CreatePurchaseOrderDTO,
    userId: number
  ): Promise<{ id: number; po_number: string }> {
    const poNumber = generatePONumber();
    const total = data.items.reduce((sum, item) => sum + item.cost_price * item.quantity, 0);

    const poId = await withTransaction(async (client) => {
      const newPoId = await this.repo.create(
        poNumber,
        data.distributor_id,
        data.notes || null,
        total,
        userId,
        client
      );

      for (const item of data.items) {
        await this.repo.createItem(
          newPoId,
          item.product_id,
          item.variant_id || null,
          item.quantity,
          item.cost_price,
          client
        );
      }

      return newPoId;
    });

    return { id: poId, po_number: poNumber };
  }

  async updateStatus(
    id: number | string,
    status: string
  ): Promise<{ id: number; status: string } | null> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      return null;
    }

    await this.repo.updateStatus(id, status);
    return { id: Number(id), status };
  }

  async receiveItems(id: number | string, data: ReceiveItemsDTO, userId: number): Promise<string> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new PublicError('NOT_FOUND', 'Purchase order not found');
    }

    if (existing.status === 'Cancelled' || existing.status === 'Received') {
      throw new PublicError('CONFLICT', `Cannot receive items for ${existing.status} order`);
    }

    return withTransaction(async (client) => {
      for (const receiveItem of data.items) {
        if (receiveItem.quantity <= 0) continue;

        const poItem = await this.repo.findPoItem(receiveItem.item_id, id, client);
        if (!poItem) continue;

        const maxReceivable = Number(poItem.quantity) - Number(poItem.received_quantity || 0);
        const actualReceive = Math.min(receiveItem.quantity, maxReceivable);
        if (actualReceive <= 0) continue;

        // Update received quantity
        await this.repo.updateItemReceivedQuantity(receiveItem.item_id, actualReceive, client);

        // Update stock
        if (poItem.variant_id) {
          await this.repo.updateVariantStock(poItem.variant_id, actualReceive, client);
        } else {
          await this.repo.updateProductStock(poItem.product_id, actualReceive, client);
        }

        // Log stock adjustment
        const newStock = await this.repo.getProductStock(poItem.product_id, client);
        await this.repo.createStockAdjustment(
          poItem.product_id,
          newStock - actualReceive,
          newStock,
          actualReceive,
          userId,
          client
        );
      }

      // Determine new PO status
      const allItems = await this.repo.getPoItemsSummary(id, client);
      const allReceived = allItems.every((i) => i.received_quantity >= i.quantity);
      const someReceived = allItems.some((i) => i.received_quantity > 0);

      let status = existing.status as string;
      if (allReceived) {
        status = 'Received';
      } else if (someReceived) {
        status = 'Partially Received';
      }

      await this.repo.updateStatus(id, status, client);
      return status;
    });
  }

  async delete(id: number | string): Promise<{ success: boolean; error?: string }> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      return { success: false, error: 'Purchase order not found' };
    }

    if (existing.status !== 'Draft') {
      return { success: false, error: 'Only Draft purchase orders can be deleted' };
    }

    await this.repo.delete(id);
    return { success: true };
  }
}

export const purchaseOrdersService = new PurchaseOrdersService();
