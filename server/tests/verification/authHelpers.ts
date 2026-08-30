import jwt from 'jsonwebtoken';
import { AuthUser } from '../../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeyforlocaltestsonly12345';

export function getTestAuthToken(user: Partial<AuthUser> = {}): string {
  const payload: AuthUser = {
    id: user.id || 1,
    email: user.email || 'admin@moon.com',
    name: user.name || 'Admin',
    role: user.role || 'Admin',
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export function getAdminToken(): string {
  return getTestAuthToken({ id: 1, email: 'admin@moon.com', name: 'Admin', role: 'Admin' });
}

export function getCashierToken(): string {
  return getTestAuthToken({
    id: 2,
    email: 'sarah@moon.com',
    name: 'Sarah Cashier',
    role: 'Cashier',
  });
}

export function getDeliveryToken(): string {
  return getTestAuthToken({
    id: 3,
    email: 'james@moon.com',
    name: 'James Delivery',
    role: 'Delivery',
  });
}
