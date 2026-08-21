import {
  getDeliveryOrders,
  getDeliveryPerformance,
  getDeliveryOrder,
  createDeliveryOrder,
  updateDeliveryOrder,
  updateDeliveryStatus,
  getOrderStatusHistory,
  generateOrderNumber,
} from '../../../services/deliveryService';
import { IDeliveryRepository, deliveryRepository as defaultRepo } from './repository';

export class DeliveryService {
  constructor(private repo: IDeliveryRepository = defaultRepo) {}

  getRepository(): IDeliveryRepository {
    return this.repo;
  }

  generateOrderNumber() {
    return generateOrderNumber();
  }

  getDeliveryOrders(filters: any) {
    return getDeliveryOrders(filters);
  }

  getDeliveryPerformance() {
    return getDeliveryPerformance();
  }

  getDeliveryOrder(id: string | number) {
    return getDeliveryOrder(id);
  }

  createDeliveryOrder(data: any) {
    return createDeliveryOrder(data);
  }

  updateDeliveryOrder(id: string | number, data: any) {
    return updateDeliveryOrder(id, data);
  }

  updateDeliveryStatus(id: string | number, input: any, userId: number) {
    return updateDeliveryStatus(id, input, userId);
  }

  getOrderStatusHistory(id: string | number) {
    return getOrderStatusHistory(id);
  }
}

export const deliveryService = new DeliveryService();
