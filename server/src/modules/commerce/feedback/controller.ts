import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { feedbackRequestContracts, feedbackSchema } from './schemas';
import type { FeedbackFilters } from './types';
import { feedbackService } from './service';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = feedbackRequestContracts;

export class FeedbackController {
  async submitFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.createFeedback.parseBody<z.infer<typeof feedbackSchema>>(req.body);

      const feedback = await feedbackService.create(parsed);
      res.status(201).json(success(feedback));
    } catch (err) {
      next(err);
    }
  }

  async getFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listFeedback.parseQuery<FeedbackFilters>(req.query);
      const result = await feedbackService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
          stats: result.stats,
        })
      );
    } catch (err) {
      next(err);
    }
  }
}

export const feedbackController = new FeedbackController();
