import type { AuthUser, UserRole } from '../types';

export function getDefaultRoute(
  user: AuthUser | { role?: UserRole | string } | null | undefined
): string {
  if (user?.role === 'Admin') return '/';
  if (user?.role === 'Cashier') return '/pos';
  if (user?.role === 'Delivery') return '/deliveries';
  return '/login';
}
