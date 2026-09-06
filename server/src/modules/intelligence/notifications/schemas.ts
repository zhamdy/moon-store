/**
 * The notifications module's request contracts (#102).
 */
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { notificationListQuerySchema } from './types';

export const notificationsRequestContracts = {
  listNotifications: defineRequestContract({
    method: 'GET',
    path: '/api/v1/notifications',
    operation: 'listNotifications',
    query: notificationListQuerySchema,
    beyondSchema: [
      'Scoped to the authenticated user; there is no parameter for whose notifications ' +
        'to read, and no way to read somebody else’s.',
    ],
  }),

  getUnreadCount: defineRequestContract({
    method: 'GET',
    path: '/api/v1/notifications/unread-count',
    operation: 'getUnreadCount',
  }),

  markAsRead: defineRequestContract({
    noBody: true,
    method: 'PUT',
    path: '/api/v1/notifications/{id}/read',
    operation: 'markAsRead',
    params: pathIdParams(),
    beyondSchema: [
      'Takes no body. Marking a notification that belongs to someone else is a no-op ' +
        'rather than an error, because the scope is the caller’s own rows.',
    ],
  }),

  markAllAsRead: defineRequestContract({
    noBody: true,
    method: 'PUT',
    path: '/api/v1/notifications/read-all',
    operation: 'markAllAsRead',
    beyondSchema: ['Takes no body. Affects only the caller’s own notifications.'],
  }),
} as const;

export const notificationsContractList = Object.values(notificationsRequestContracts);
