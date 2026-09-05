import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { reservationsService, IReservationsService } from './service';
import { success } from '../../../http/responses';

const reserveSchema = z.object({
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive(),
  source_type: z.enum(['cart', 'delivery', 'held']),
  source_id: z.string().optional(),
});

export class ReservationsController {
  constructor(private service: IReservationsService = reservationsService) {}

  async createReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = reserveSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const reservation = await this.service.createReservation(parsed.data);
      res.status(201).json(success(reservation));
    } catch (err) {
      // Typed at the throw site (#47); the status is no longer derived from the wording.
      next(err);
    }
  }

  async deleteReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.service.releaseReservation(req.params.id as string);
      res.sendStatus(204);
    } catch (err) {
      // Typed at the throw site (#47); the status is no longer derived from the wording.
      next(err);
    }
  }

  async deleteBySourceId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const released = await this.service.releaseBySourceId(req.params.sourceId as string);
      res.json(success({ released }));
    } catch (err) {
      next(err);
    }
  }
}

export const reservationsController = new ReservationsController();
