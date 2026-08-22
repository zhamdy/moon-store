export interface NotificationRecord {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  link: string | null;
  read: number;
  created_at: string;
}

export interface CreateNotificationDTO {
  userId: number | null;
  type: string;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string | number;
  link?: string;
}

export interface NotificationFilters {
  page: number;
  pageSize: number;
  unreadOnly?: boolean;
}

import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

const notificationListQuerySchema = createListQuerySchema(['createdAt'] as const)
  .extend({
    unreadOnly: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();

export function parseNotificationListQuery(query: unknown): NotificationFilters {
  const parsed = notificationListQuerySchema.parse(query);
  return { page: parsed.page, pageSize: parsed.pageSize, unreadOnly: parsed.unreadOnly };
}
