import { Request, Response, NextFunction } from 'express';
import { reservationsRequestContracts, type ReserveBody } from './schemas';
import { reservationsService, IReservationsService } from './service';
import { success } from '../../../http/responses';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = reservationsRequestContracts;

export class ReservationsController {
  constructor(private service: IReservationsService = reservationsService) {}

  async createReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.createReservation.parseBody<ReserveBody>(req.body);

      const reservation = await this.service.createReservation(parsed);
      res.status(201).json(success(reservation));
    } catch (err) {
      // Typed at the throw site (#47); the status is no longer derived from the wording.
      next(err);
    }
  }

  async deleteReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.releaseReservation.parseParams<{ id: string }>(req.params);
      await this.service.releaseReservation(id);
      res.sendStatus(204);
    } catch (err) {
      // Typed at the throw site (#47); the status is no longer derived from the wording.
      next(err);
    }
  }

  async deleteBySourceId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sourceId } = contracts.releaseBySource.parseParams<{ sourceId: string }>(req.params);
      const released = await this.service.releaseBySourceId(sourceId);
      res.json(success({ released }));
    } catch (err) {
      next(err);
    }
  }
}

export const reservationsController = new ReservationsController();
