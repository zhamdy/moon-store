import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './service';
import {
  parseAnalyticsDateQuery,
  parseAnalyticsDaysPageQuery,
  parseAnalyticsPageQuery,
} from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';

const page = <T>(items: T[], pageNumber: number, pageSize: number) => ({
  items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
  meta: { pagination: paginationMeta(pageNumber, pageSize, items.length) },
});

export class AnalyticsController {
  async getDashboardAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = parseAnalyticsDateQuery(req.query);
      const data = await analyticsService.getDashboardAll(from, to);
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getDashboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.getDashboardKpis();
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getRevenue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = parseAnalyticsDateQuery(req.query);
      const data = await analyticsService.getRevenueByDate(from, to);
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getTopProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseAnalyticsPageQuery(req.query);
      const { from, to } = query;
      const data = await analyticsService.getTopProducts(from, to);
      const result = page(data, query.page, query.pageSize);
      res.json(success(result.items, result.meta));
    } catch (err) {
      next(err);
    }
  }

  async getPaymentMethods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = parseAnalyticsDateQuery(req.query);
      const data = await analyticsService.getPaymentMethodBreakdown(from, to);
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getOrdersPerDay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = parseAnalyticsDateQuery(req.query);
      const data = await analyticsService.getOrdersPerDay(from, to);
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getCashierPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseAnalyticsPageQuery(req.query);
      const { from, to } = query;
      const data = await analyticsService.getCashierPerformance(from, to);
      const result = page(data, query.page, query.pageSize);
      res.json(success(result.items, result.meta));
    } catch (err) {
      next(err);
    }
  }

  async getSalesByCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseAnalyticsPageQuery(req.query);
      const { from, to } = query;
      const data = await analyticsService.getSalesByCategory(from, to);
      const result = page(data, query.page, query.pageSize);
      res.json(success(result.items, result.meta));
    } catch (err) {
      next(err);
    }
  }

  async getSalesByDistributor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseAnalyticsPageQuery(req.query);
      const { from, to } = query;
      const data = await analyticsService.getSalesByDistributor(from, to);
      const result = page(data, query.page, query.pageSize);
      res.json(success(result.items, result.meta));
    } catch (err) {
      next(err);
    }
  }

  async getDeadStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseAnalyticsDaysPageQuery(req.query, 90);
      const data = await analyticsService.getDeadStock(query.days);
      const result = page(data.products, query.page, query.pageSize);
      res.json(success({ ...data, products: result.items }, result.meta));
    } catch (err) {
      next(err);
    }
  }

  async getCustomerLtv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseAnalyticsPageQuery(req.query);
      const { from, to } = query;
      const data = await analyticsService.getCustomerLtv(from, to);
      const result = page(data.customers, query.page, query.pageSize);
      res.json(success({ ...data, customers: result.items }, result.meta));
    } catch (err) {
      next(err);
    }
  }

  async getHourlyHeatmap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { days } = parseAnalyticsDaysPageQuery(req.query, 30);
      const data = await analyticsService.getHourlyHeatmap(days);
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getAbcClassification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.getAbcClassification();
      const query = parseAnalyticsPageQuery(req.query);
      const result = page(data.products, query.page, query.pageSize);
      res.json(success({ ...data, products: result.items }, result.meta));
    } catch (err) {
      next(err);
    }
  }

  async getReorderSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.getReorderSuggestions();
      const query = parseAnalyticsPageQuery(req.query);
      const result = page(data, query.page, query.pageSize);
      res.json(success(result.items, result.meta));
    } catch (err) {
      next(err);
    }
  }

  async createInventorySnapshot(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.createInventorySnapshot();
      res.status(201).json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getInventorySnapshots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.getInventorySnapshots();
      const query = parseAnalyticsPageQuery(req.query);
      const result = page(data, query.page, query.pageSize);
      res.json(success(result.items, result.meta));
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
