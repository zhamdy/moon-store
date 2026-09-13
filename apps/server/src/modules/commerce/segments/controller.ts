import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { segmentsRequestContracts, segmentSchema } from './schemas';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { segmentsService } from './service';
import { success } from '../../../http/responses';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = segmentsRequestContracts;

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
      const parsed = contracts.createSegment.parseBody<z.infer<typeof segmentSchema>>(req.body);

      const segment = await segmentsService.create(parsed);
      logAuditFromReq(req, 'create', 'segment', segment.id, { name: parsed.name });
      res.status(201).json(success(segment));
    } catch (err) {
      next(err);
    }
  }

  async updateSegment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.updateSegment.parseParams<{ id: string }>(req.params);
      const parsed = contracts.updateSegment.parseBody<z.infer<typeof segmentSchema>>(req.body);

      const segment = await segmentsService.update(id as string, parsed);
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
      const { id } = contracts.deleteSegment.parseParams<{ id: string }>(req.params);
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
