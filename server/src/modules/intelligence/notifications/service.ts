import { INotificationsRepository, notificationsRepository as defaultRepo } from './repository';
import { CreateNotificationDTO, NotificationFilters, NotificationRecord } from './types';

export class NotificationsService {
  constructor(private repo: INotificationsRepository = defaultRepo) {}

  getRepository(): INotificationsRepository {
    return this.repo;
  }

  async list(
    userId: number,
    filters: NotificationFilters
  ): Promise<{ rows: NotificationRecord[]; total: number; unreadCount: number }> {
    const unreadOnly = filters.unreadOnly ?? false;

    const [result, unreadCount] = await Promise.all([
      this.repo.list(userId, unreadOnly, filters.page, filters.pageSize),
      this.repo.getUnreadCount(userId),
    ]);

    return { ...result, unreadCount };
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.repo.getUnreadCount(userId);
  }

  async markAsRead(id: number | string, userId: number): Promise<void> {
    await this.repo.markAsRead(id, userId);
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.repo.markAllAsRead(userId);
  }

  async createNotification(notif: CreateNotificationDTO): Promise<void> {
    try {
      const message = notif.message || null;
      const entityType = notif.entityType || null;
      const entityId = notif.entityId != null ? String(notif.entityId) : null;
      const link = notif.link || null;

      if (notif.userId) {
        await this.repo.create(
          notif.userId,
          notif.type,
          notif.title,
          message,
          entityType,
          entityId,
          link
        );
      } else {
        const adminIds = await this.repo.getAdminIds();
        for (const adminId of adminIds) {
          await this.repo.create(
            adminId,
            notif.type,
            notif.title,
            message,
            entityType,
            entityId,
            link
          );
        }
      }
    } catch {
      // Notifications should never crash the app
    }
  }

  notifyLowStock(productName: string, stock: number, productId: number): void {
    this.createNotification({
      userId: null,
      type: 'low_stock',
      title: `Low stock: ${productName}`,
      message: `${productName} has ${stock} items remaining`,
      entityType: 'product',
      entityId: productId,
      link: '/inventory?lowStock=true',
    }).catch(() => {});
  }

  notifySale(total: number, saleId: number, cashierName: string): void {
    this.createNotification({
      userId: null,
      type: 'new_sale',
      title: `New sale #${saleId}`,
      message: `${cashierName} completed a sale for ${total.toFixed(2)}`,
      entityType: 'sale',
      entityId: saleId,
      link: '/sales',
    }).catch(() => {});
  }

  notifyDeliveryOverdue(orderNumber: string, orderId: number, assignedTo: number | null): void {
    this.createNotification({
      userId: assignedTo,
      type: 'delivery_overdue',
      title: `Delivery overdue: ${orderNumber}`,
      message: `Order ${orderNumber} is past its estimated delivery time`,
      entityType: 'delivery',
      entityId: orderId,
      link: '/deliveries',
    }).catch(() => {});

    if (assignedTo) {
      this.createNotification({
        userId: null,
        type: 'delivery_overdue',
        title: `Delivery overdue: ${orderNumber}`,
        message: `Order ${orderNumber} is past its estimated delivery time`,
        entityType: 'delivery',
        entityId: orderId,
        link: '/deliveries',
      }).catch(() => {});
    }
  }
}

export const notificationsService = new NotificationsService();

export const createNotification = (notif: CreateNotificationDTO) =>
  notificationsService.createNotification(notif);
export const notifyLowStock = (productName: string, stock: number, productId: number) =>
  notificationsService.notifyLowStock(productName, stock, productId);
export const notifySale = (total: number, saleId: number, cashierName: string) =>
  notificationsService.notifySale(total, saleId, cashierName);
export const notifyDeliveryOverdue = (
  orderNumber: string,
  orderId: number,
  assignedTo: number | null
) => notificationsService.notifyDeliveryOverdue(orderNumber, orderId, assignedTo);
