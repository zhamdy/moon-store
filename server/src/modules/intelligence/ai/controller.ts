import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { aiListQuerySchema, forecastQuerySchema, recommendationQuerySchema } from './types';
import { aiRequestContracts } from './schemas';
import { aiService } from './service';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = aiRequestContracts;

export class AiController {
  async getForecast(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      contracts.getForecast.parseQuery<z.infer<typeof forecastQuerySchema>>(req.query);
      res.json(success(await aiService.getForecast()));
    } catch (err) {
      next(err);
    }
  }

  async getRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.getRecommendations.parseQuery<
        z.infer<typeof recommendationQuerySchema>
      >(req.query);
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
      const query = contracts.getPricingSuggestions.parseQuery<z.infer<typeof aiListQuerySchema>>(
        req.query
      );
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
      const query = contracts.getChurnRisk.parseQuery<z.infer<typeof aiListQuerySchema>>(req.query);
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
      const query = contracts.getAnomalies.parseQuery<z.infer<typeof aiListQuerySchema>>(req.query);
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
