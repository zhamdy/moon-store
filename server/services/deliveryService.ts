import {
  deliveryService,
  generateDeliveryOrderNumber,
  DeliveryOrderFilters,
  DeliveryOrderInput,
  StatusUpdateInput,
  DeliveryListResult,
  PerformanceResult,
  DeliveryHistoryFilters,
} from '../src/modules/fulfillment/delivery';

export {
  DeliveryOrderFilters,
  DeliveryOrderInput,
  StatusUpdateInput,
  DeliveryListResult,
  PerformanceResult,
  DeliveryHistoryFilters,
};

export const generateOrderNumber = generateDeliveryOrderNumber;

export async function getDeliveryOrders(
  filters: DeliveryOrderFilters
): Promise<DeliveryListResult> {
  return deliveryService.getDeliveryOrders(filters);
}

export async function getDeliveryPerformance(): Promise<PerformanceResult> {
  return deliveryService.getDeliveryPerformance();
}

export async function getDeliveryOrder(id: string | number): Promise<Record<string, any> | null> {
  return deliveryService.getDeliveryOrder(id);
}

export async function createDeliveryOrder(data: DeliveryOrderInput): Promise<Record<string, any>> {
  return deliveryService.createDeliveryOrder(data);
}

export async function updateDeliveryOrder(
  id: string | number,
  data: DeliveryOrderInput
): Promise<Record<string, any>> {
  return deliveryService.updateDeliveryOrder(id, data);
}

export async function updateDeliveryStatus(
  id: string | number,
  input: StatusUpdateInput,
  userId: number
): Promise<Record<string, any> | null> {
  return deliveryService.updateDeliveryStatus(id, input, userId);
}

export async function getOrderStatusHistory(id: string | number, filters: DeliveryHistoryFilters) {
  return deliveryService.getOrderStatusHistory(id, filters);
}
