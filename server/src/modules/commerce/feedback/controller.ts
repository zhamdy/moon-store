import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { feedbackService } from './service';
import { parseFeedbackListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';

export const feedbackSchema = z.object({
  customer_id: z.number().int().positive().optional(),
  sale_id: z.number().int().positive().optional(),
  rating: z.number().int().min(1).max(5),
  category: z
    .enum(['service', 'product_quality', 'pricing', 'store_ambiance', 'general'])
    .default('general'),
  comment: z.string().max(500).optional(),
});

export class FeedbackController {
  async submitFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = feedbackSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const feedback = await feedbackService.create(parsed.data);
      res.status(201).json(success(feedback));
    } catch (err) {
      next(err);
    }
  }

  async getFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseFeedbackListQuery(req.query);
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
