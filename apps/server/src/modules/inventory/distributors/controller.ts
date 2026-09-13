import { Request, Response, NextFunction } from 'express';
import { distributorsRequestContracts } from './schemas';
import type { Distributor } from '../../../../validators/distributorSchema';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { distributorsService } from './service';
import { success } from '../../../http/responses';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = distributorsRequestContracts;

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
      const parsed = contracts.createDistributor.parseBody<Distributor>(req.body);

      const { name, contact_person, phone, email, address, notes } = parsed;
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
      const parsed = contracts.updateDistributor.parseBody<Distributor>(req.body);

      const { name, contact_person, phone, email, address, notes } = parsed;
      const { id } = contracts.updateDistributor.parseParams<{ id: string }>(req.params);
      const distributor = await distributorsService.update(id, {
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
      const { id } = contracts.deleteDistributor.parseParams<{ id: string }>(req.params);
      const result = await distributorsService.delete(id);
      if (!result.success) {
        const code = result.error === 'Distributor not found' ? 'NOT_FOUND' : 'CONFLICT';
        throw new PublicError(code, result.error);
      }

      logAuditFromReq(req, 'delete', 'distributor', id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const distributorsController = new DistributorsController();
