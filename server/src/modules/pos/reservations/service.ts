import logger from '../../../../lib/logger';
import { IReservationsRepository, reservationsRepository as defaultRepo } from './repository';
import { CreateReservationDTO, ReservationRow } from './types';

export interface IReservationsService {
  createReservation(data: CreateReservationDTO): Promise<ReservationRow>;
  releaseReservation(id: number | string): Promise<void>;
  releaseBySourceId(sourceId: string): Promise<number>;
  cleanupExpiredReservations(): Promise<void>;
}

export class ReservationsService implements IReservationsService {
  constructor(private repo: IReservationsRepository = defaultRepo) {}

  getRepository(): IReservationsRepository {
    return this.repo;
  }

  async createReservation(data: CreateReservationDTO): Promise<ReservationRow> {
    const { product_id, variant_id, quantity, source_type, source_id } = data;
    const expiryMinutes = source_type === 'cart' ? 15 : source_type === 'held' ? 480 : 1440;

    let currentStock: number;
    if (variant_id) {
      currentStock = await this.repo.getVariantStock(variant_id);
    } else {
      currentStock = await this.repo.getProductStock(product_id);
    }

    const reservedTotal = await this.repo.getReservedQuantity(product_id, variant_id);
    const available = currentStock - reservedTotal;
    if (available < quantity) {
      throw new Error('Insufficient available stock');
    }

    return this.repo.createReservation({
      product_id,
      variant_id,
      quantity,
      source_type,
      source_id,
      expiryMinutes,
    });
  }

  async releaseReservation(id: number | string): Promise<void> {
    const deleted = await this.repo.deleteById(id);
    if (!deleted) {
      throw new Error('Reservation not found');
    }
  }

  async releaseBySourceId(sourceId: string): Promise<number> {
    return this.repo.deleteBySourceId(sourceId);
  }

  async cleanupExpiredReservations(): Promise<void> {
    try {
      const count = await this.repo.deleteExpired();
      if (count > 0) {
        logger.info('Cleaned up expired reservations', { count });
      }
    } catch (err) {
      logger.error('Reservation cleanup failed', { error: (err as Error).message });
    }
  }
}

export const reservationsService = new ReservationsService();

// Standalone function for scheduled jobs / router exports
export async function cleanupExpiredReservations(): Promise<void> {
  return reservationsService.cleanupExpiredReservations();
}
