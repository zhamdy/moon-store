import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { segmentsService } from './service';

export const segmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rules_json: z.string().min(2),
});

export class SegmentsController {
  async getSegments(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const segments = await segmentsService.list();
      res.json({ success: true, data: segments });
    } catch (err) {
      next(err);
    }
  }

  async createSegment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = segmentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const segment = await segmentsService.create(parsed.data);
      logAuditFromReq(req, 'create', 'segment', segment.id, { name: parsed.data.name });
      res.status(201).json({ success: true, data: segment });
    } catch (err) {
      next(err);
    }
  }

  async updateSegment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = segmentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const segment = await segmentsService.update(id as string, parsed.data);
      if (!segment) {
        res.status(404).json({ success: false, error: 'Segment not found' });
        return;
      }

      logAuditFromReq(req, 'update', 'segment', Number(id));
      res.json({ success: true, data: segment });
    } catch (err) {
      next(err);
    }
  }

  async deleteSegment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await segmentsService.delete(id as string);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Segment not found' });
        return;
      }

      logAuditFromReq(req, 'delete', 'segment', Number(id));
      res.json({ success: true, data: { message: 'Segment deleted' } });
    } catch (err) {
      next(err);
    }
  }
}

export const segmentsController = new SegmentsController();
