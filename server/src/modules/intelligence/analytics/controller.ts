import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './service';

export class AnalyticsController {
  async getDashboardAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query;
      const data = await analyticsService.getDashboardAll(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getDashboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.getDashboardKpis();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getRevenue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query;
      const data = await analyticsService.getRevenueByDate(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getTopProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query;
      const data = await analyticsService.getTopProducts(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getPaymentMethods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query;
      const data = await analyticsService.getPaymentMethodBreakdown(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getOrdersPerDay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query;
      const data = await analyticsService.getOrdersPerDay(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getCashierPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query;
      const data = await analyticsService.getCashierPerformance(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getSalesByCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query;
      const data = await analyticsService.getSalesByCategory(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getSalesByDistributor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query;
      const data = await analyticsService.getSalesByDistributor(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getDeadStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = parseInt(req.query.days as string, 10) || 90;
      const data = await analyticsService.getDeadStock(days);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getCustomerLtv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query;
      const data = await analyticsService.getCustomerLtv(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getHourlyHeatmap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = parseInt(req.query.days as string, 10) || 30;
      const data = await analyticsService.getHourlyHeatmap(days);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getAbcClassification(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.getAbcClassification();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getReorderSuggestions(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.getReorderSuggestions();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createInventorySnapshot(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = await analyticsService.createInventorySnapshot();
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getInventorySnapshots(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.getInventorySnapshots();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
