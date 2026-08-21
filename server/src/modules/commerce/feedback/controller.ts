import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { feedbackService } from './service';

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
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const feedback = await feedbackService.create(parsed.data);
      res.status(201).json({ success: true, data: feedback });
    } catch (err) {
      next(err);
    }
  }

  async getFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rating, category, page = '1', limit = '20' } = req.query;

      const result = await feedbackService.list({
        rating: rating !== undefined ? Number(rating) : undefined,
        category: category as string | undefined,
        page: Number(page),
        limit: Number(limit),
      });

      res.json({
        success: true,
        data: result.rows,
        stats: result.stats,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const feedbackController = new FeedbackController();
