import { Request, Response, NextFunction } from 'express';
import { distributorSchema } from '../../../../validators/distributorSchema';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { distributorsService } from './service';

export class DistributorsController {
  async getDistributors(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await distributorsService.findAll();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createDistributor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = distributorSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
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
      res.status(201).json({ success: true, data: distributor });
    } catch (err) {
      next(err);
    }
  }

  async updateDistributor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = distributorSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
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
        res.status(404).json({ success: false, error: 'Distributor not found' });
        return;
      }

      res.json({ success: true, data: distributor });
    } catch (err) {
      next(err);
    }
  }

  async deleteDistributor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await distributorsService.delete(req.params.id as string);
      if (!result.success) {
        const statusCode = result.error === 'Distributor not found' ? 404 : 400;
        res.status(statusCode).json({ success: false, error: result.error });
        return;
      }

      logAuditFromReq(req, 'delete', 'distributor', req.params.id as string);
      res.json({ success: true, data: { message: 'Distributor deleted' } });
    } catch (err) {
      next(err);
    }
  }
}

export const distributorsController = new DistributorsController();
