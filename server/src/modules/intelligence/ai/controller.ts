import { Request, Response, NextFunction } from 'express';
import { aiService } from './service';

export class AiController {
  async getForecast(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await aiService.getForecast();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.query;
      const data = await aiService.getRecommendations(productId as string | undefined);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getPricingSuggestions(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await aiService.getPricingSuggestions();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getChurnRisk(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await aiService.getChurnRisk();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getAnomalies(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await aiService.getAnomalies();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const aiController = new AiController();
