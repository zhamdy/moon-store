import { Request, Response, NextFunction } from 'express';
import { aiService } from './service';
import { parseAiListQuery, parseForecastQuery, parseRecommendationQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';

export class AiController {
  async getForecast(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      parseForecastQuery(req.query);
      res.json(success(await aiService.getForecast()));
    } catch (err) {
      next(err);
    }
  }

  async getRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseRecommendationQuery(req.query);
      const result = await aiService.getRecommendationsPage(
        query.productId,
        query.page,
        query.pageSize
      );
      res.json(
        success(result.data, {
          pagination: paginationMeta(query.page, query.pageSize, result.totalItems),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getPricingSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseAiListQuery(req.query);
      const result = await aiService.getPricingSuggestionsPage(query.page, query.pageSize);
      res.json(
        success(result.items, {
          pagination: paginationMeta(query.page, query.pageSize, result.totalItems),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getChurnRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseAiListQuery(req.query);
      const result = await aiService.getChurnRiskPage(query.page, query.pageSize);
      res.json(
        success(result.data, {
          pagination: paginationMeta(query.page, query.pageSize, result.totalItems),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getAnomalies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseAiListQuery(req.query);
      const result = await aiService.getAnomaliesPage(query.page, query.pageSize);
      res.json(
        success(result.data, {
          pagination: paginationMeta(query.page, query.pageSize, result.totalItems),
        })
      );
    } catch (err) {
      next(err);
    }
  }
}

export const aiController = new AiController();
