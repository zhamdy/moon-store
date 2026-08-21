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
