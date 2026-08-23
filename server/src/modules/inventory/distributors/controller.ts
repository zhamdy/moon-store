import { Request, Response, NextFunction } from 'express';
import { distributorSchema } from '../../../../validators/distributorSchema';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { distributorsService } from './service';
import { success } from '../../../http/responses';
import { PublicError } from '../../../http/errors';

export class DistributorsController {
  async getDistributors(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await distributorsService.findAll();
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async createDistributor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = distributorSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const { name, contact_person, phone, email, address, notes } = parsed.data;
      const distributor = await distributorsService.create({
        name,
        contact_person,
        phone,
        email,
        address,
        notes,
      });

      logAuditFromReq(req, 'create', 'distributor', distributor.id, { name });
      res.status(201).json(success(distributor));
    } catch (err) {
      next(err);
    }
  }

  async updateDistributor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = distributorSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const { name, contact_person, phone, email, address, notes } = parsed.data;
      const distributor = await distributorsService.update(req.params.id as string, {
        name,
        contact_person,
        phone,
        email,
        address,
        notes,
      });

      if (!distributor) {
        throw new PublicError('NOT_FOUND', 'Distributor not found');
      }

      res.json(success(distributor));
    } catch (err) {
      next(err);
    }
  }

  async deleteDistributor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await distributorsService.delete(req.params.id as string);
      if (!result.success) {
        const code = result.error === 'Distributor not found' ? 'NOT_FOUND' : 'CONFLICT';
        throw new PublicError(code, result.error);
      }

      logAuditFromReq(req, 'delete', 'distributor', req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const distributorsController = new DistributorsController();
