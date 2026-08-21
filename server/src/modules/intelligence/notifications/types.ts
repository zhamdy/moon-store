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
  limit?: number | string;
  unread_only?: string | boolean;
}
