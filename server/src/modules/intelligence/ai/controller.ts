import { Request, Response, NextFunction } from 'express';
import { aiService } from './service';
import { parseAiListQuery, parseRecommendationQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';

const page = <T>(items: T[], pageNumber: number, pageSize: number) => ({
  items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
  meta: { pagination: paginationMeta(pageNumber, pageSize, items.length) },
});

export class AiController {
  async getForecast(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await aiService.getForecast();
      const query = parseAiListQuery(req.query);
      const result = page(data.forecasts, query.page, query.pageSize);
      res.json(success({ ...data, forecasts: result.items }, result.meta));
    } catch (err) {
      next(err);
    }
  }

  async getRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseRecommendationQuery(req.query);
      const data = await aiService.getRecommendations(query.productId?.toString());
      if (data.recommendations) {
        const result = page(data.recommendations, query.page, query.pageSize);
        res.json(success({ ...data, recommendations: result.items }, result.meta));
      } else {
        const result = page(data.topPairs ?? [], query.page, query.pageSize);
        res.json(success({ ...data, topPairs: result.items }, result.meta));
      }
    } catch (err) {
      next(err);
    }
  }

  async getPricingSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await aiService.getPricingSuggestions();
      const query = parseAiListQuery(req.query);
      const result = page(data, query.page, query.pageSize);
      res.json(success(result.items, result.meta));
    } catch (err) {
      next(err);
    }
  }

  async getChurnRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await aiService.getChurnRisk();
      const query = parseAiListQuery(req.query);
      const result = page(data.customers, query.page, query.pageSize);
      res.json(success({ ...data, customers: result.items }, result.meta));
    } catch (err) {
      next(err);
    }
  }

  async getAnomalies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await aiService.getAnomalies();
      const query = parseAiListQuery(req.query);
      const result = page(data.anomalies, query.page, query.pageSize);
      res.json(success({ ...data, anomalies: result.items }, result.meta));
    } catch (err) {
      next(err);
    }
  }
}

export const aiController = new AiController();
