import db from '../db';

interface CreateNotification {
  userId: number | null;
  type: string;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string | number;
  link?: string;
}

/**
 * Create a notification for a specific user.
 * If userId is null, create for all Admin users.
 */
export function createNotification(notif: CreateNotification): void {
  try {
    if (notif.userId) {
      db.db
        .prepare(
          `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, link)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          notif.userId,
          notif.type,
          notif.title,
          notif.message || null,
          notif.entityType || null,
          notif.entityId != null ? String(notif.entityId) : null,
          notif.link || null
        );
    } else {
      // Broadcast to all Admin users
      const admins = db.db.prepare(`SELECT id FROM users WHERE role = 'Admin'`).all() as Array<{
        id: number;
      }>;

      const stmt = db.db.prepare(
        `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, link)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );

      for (const admin of admins) {
        stmt.run(
          admin.id,
          notif.type,
          notif.title,
          notif.message || null,
          notif.entityType || null,
          notif.entityId != null ? String(notif.entityId) : null,
          notif.link || null
        );
      }
    }
  } catch {
    // Notifications should never crash the app
  }
}

/**
 * Notify admins about low stock products.
 */
export function notifyLowStock(productName: string, stock: number, productId: number): void {
  createNotification({
    userId: null,
    type: 'low_stock',
    title: `Low stock: ${productName}`,
    message: `${productName} has ${stock} items remaining`,
    entityType: 'product',
    entityId: productId,
    link: '/inventory?lowStock=true',
  });
}

/**
 * Notify admins about a new sale.
 */
export function notifySale(total: number, saleId: number, cashierName: string): void {
  createNotification({
    userId: null,
    type: 'new_sale',
    title: `New sale #${saleId}`,
    message: `${cashierName} completed a sale for ${total.toFixed(2)}`,
    entityType: 'sale',
    entityId: saleId,
    link: '/sales',
  });
}

/**
 * Notify about overdue delivery.
 */
export function notifyDeliveryOverdue(
  orderNumber: string,
  orderId: number,
  assignedTo: number | null
): void {
  createNotification({
    userId: assignedTo,
    type: 'delivery_overdue',
    title: `Delivery overdue: ${orderNumber}`,
    message: `Order ${orderNumber} is past its estimated delivery time`,
    entityType: 'delivery',
    entityId: orderId,
    link: '/deliveries',
  });
  // Also notify admins
  if (assignedTo) {
    createNotification({
      userId: null,
      type: 'delivery_overdue',
      title: `Delivery overdue: ${orderNumber}`,
      message: `Order ${orderNumber} is past its estimated delivery time`,
      entityType: 'delivery',
      entityId: orderId,
      link: '/deliveries',
    });
  }
}
