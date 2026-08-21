import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { reservationsService, IReservationsService } from './service';

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
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const reservation = await this.service.createReservation(parsed.data);
      res.status(201).json({ success: true, data: reservation });
    } catch (err: any) {
      if (err.message === 'Insufficient available stock') {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async deleteReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.service.releaseReservation(req.params.id as string);
      res.json({ success: true, data: { message: 'Reservation released' } });
    } catch (err: any) {
      if (err.message === 'Reservation not found') {
        res.status(404).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async deleteBySourceId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const released = await this.service.releaseBySourceId(req.params.sourceId as string);
      res.json({ success: true, data: { released } });
    } catch (err) {
      next(err);
    }
  }
}

export const reservationsController = new ReservationsController();
