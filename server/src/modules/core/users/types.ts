export interface UserListItem {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
  last_login?: string | null;
}

export interface DeliveryUser {
  id: number;
  name: string;
  email: string;
}

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  role: 'Admin' | 'Cashier' | 'Delivery';
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  password?: string | null;
  role?: 'Admin' | 'Cashier' | 'Delivery';
}

export interface UserDbRecord {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
  last_login?: string | null;
  favorites?: any;
}

export interface UserListQuery {
  page: number;
  pageSize: number;
  search?: string;
  role?: 'Admin' | 'Cashier' | 'Delivery';
  sortBy: 'name' | 'email' | 'role' | 'createdAt' | 'lastLogin';
  sortOrder: 'asc' | 'desc';
}

const positiveInteger = (field: string) =>
  z
    .string()
    .regex(/^\d+$/, `${field} must be a positive integer`)
    .transform(Number)
    .pipe(z.number().int().positive());

const userListQuerySchema = z
  .object({
    page: positiveInteger('page').default('1'),
    pageSize: z.enum(['10', '25', '50', '100']).default('25').transform(Number),
    search: z.string().trim().min(1).max(100).optional(),
    role: z.enum(['Admin', 'Cashier', 'Delivery']).optional(),
    sortBy: z.enum(['name', 'email', 'role', 'createdAt', 'lastLogin']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export function parseUserListQuery(input: unknown): UserListQuery {
  return userListQuerySchema.parse(input);
}
import { z } from 'zod';
