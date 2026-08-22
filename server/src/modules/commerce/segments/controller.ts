import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { segmentsService } from './service';
import { success } from '../../../http/responses';
import { PublicError } from '../../../http/errors';

export const segmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rules_json: z.string().min(2),
});

export class SegmentsController {
  async getSegments(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const segments = await segmentsService.list();
      res.json(success(segments));
    } catch (err) {
      next(err);
    }
  }

  async createSegment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = segmentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const segment = await segmentsService.create(parsed.data);
      logAuditFromReq(req, 'create', 'segment', segment.id, { name: parsed.data.name });
      res.status(201).json(success(segment));
    } catch (err) {
      next(err);
    }
  }

  async updateSegment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = segmentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const segment = await segmentsService.update(id as string, parsed.data);
      if (!segment) {
        throw new PublicError('NOT_FOUND', 'Segment not found');
      }

      logAuditFromReq(req, 'update', 'segment', Number(id));
      res.json(success(segment));
    } catch (err) {
      next(err);
    }
  }

  async deleteSegment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await segmentsService.delete(id as string);
      if (!deleted) {
        throw new PublicError('NOT_FOUND', 'Segment not found');
      }

      logAuditFromReq(req, 'delete', 'segment', Number(id));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const segmentsController = new SegmentsController();
