import bcrypt from 'bcrypt';
import { IUsersRepository, usersRepository as defaultRepo } from './repository';
import { CreateUserDTO, UpdateUserDTO, UserListItem, DeliveryUser } from './types';

export class UsersService {
  constructor(private repo: IUsersRepository = defaultRepo) {}

  async list(): Promise<UserListItem[]> {
    return this.repo.findAll();
  }

  async listDeliveryUsers(): Promise<DeliveryUser[]> {
    return this.repo.findDeliveryUsers();
  }

  async create(data: CreateUserDTO): Promise<UserListItem> {
    const hash = await bcrypt.hash(data.password, 10);
    return this.repo.create({
      name: data.name,
      email: data.email,
      password_hash: hash,
      role: data.role,
    });
  }

  async update(id: number | string, data: UpdateUserDTO): Promise<UserListItem> {
    const current = await this.repo.findById(id);
    if (!current) {
      const err = new Error('User not found');
      (err as any).statusCode = 404;
      throw err;
    }

    const newName = data.name || current.name;
    const newEmail = data.email || current.email;
    const newRole = data.role || current.role;
    let newHash = current.password_hash;
    if (data.password) {
      newHash = await bcrypt.hash(data.password, 10);
    }

    const updated = await this.repo.update(id, {
      name: newName,
      email: newEmail,
      password_hash: newHash,
      role: newRole,
    });

    if (!updated) {
      const err = new Error('User not found');
      (err as any).statusCode = 404;
      throw err;
    }
    return updated;
  }

  async getFavorites(userId: number): Promise<any[]> {
    return this.repo.getFavorites(userId);
  }

  async updateFavorites(userId: number, favorites: any[]): Promise<any[]> {
    await this.repo.updateFavorites(userId, favorites);
    return favorites;
  }

  async delete(id: number | string, currentUserId: number): Promise<void> {
    if (parseInt(String(id), 10) === currentUserId) {
      const err = new Error('Cannot delete your own account');
      (err as any).statusCode = 400;
      throw err;
    }

    const deleted = await this.repo.delete(id);
    if (!deleted) {
      const err = new Error('User not found');
      (err as any).statusCode = 404;
      throw err;
    }
  }
}

export const usersService = new UsersService();
