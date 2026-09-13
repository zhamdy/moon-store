import { IReservationsRepository, reservationsRepository as defaultRepo } from './repository';
import { CreateReservationDTO, ReservationRow } from './types';
import { PublicError } from '../../../http/errors';

export interface IReservationsService {
  createReservation(data: CreateReservationDTO): Promise<ReservationRow>;
  releaseReservation(id: number | string): Promise<void>;
  releaseBySourceId(sourceId: string): Promise<number>;
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
      throw new PublicError('VALIDATION_ERROR', 'Insufficient available stock');
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
      throw new PublicError('NOT_FOUND', 'Reservation not found');
    }
  }

  async releaseBySourceId(sourceId: string): Promise<number> {
    return this.repo.deleteBySourceId(sourceId);
  }
}

export const reservationsService = new ReservationsService();
