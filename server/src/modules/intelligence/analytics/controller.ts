import { Request, Response, NextFunction } from 'express';
import { analyticsRequestContracts } from './schemas';
import { analyticsService } from './service';
import { withDefaultDays, type AnalyticsPageQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = analyticsRequestContracts;

export class AnalyticsController {
  async getDashboardAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = contracts.getDashboardAll.parseQuery<{ from?: string; to?: string }>(
        req.query
      );
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
      const { from, to } = contracts.getRevenue.parseQuery<{ from?: string; to?: string }>(
        req.query
      );
      const data = await analyticsService.getRevenueByDate(from, to);
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getTopProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.getTopProducts.parseQuery<AnalyticsPageQuery>(req.query);
      const { from, to } = query;
      const result = await analyticsService.getTopProductsPage(
        query.page,
        query.pageSize,
        from,
        to
      );
      res.json(
        success(result.items, {
          pagination: paginationMeta(query.page, query.pageSize, result.totalItems),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getPaymentMethods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = contracts.getPaymentMethods.parseQuery<{ from?: string; to?: string }>(
        req.query
      );
      const data = await analyticsService.getPaymentMethodBreakdown(from, to);
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getOrdersPerDay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = contracts.getOrdersPerDay.parseQuery<{ from?: string; to?: string }>(
        req.query
      );
      const data = await analyticsService.getOrdersPerDay(from, to);
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getCashierPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.getCashierPerformance.parseQuery<AnalyticsPageQuery>(req.query);
      const { from, to } = query;
      const result = await analyticsService.getCashierPerformancePage(
        query.page,
        query.pageSize,
        from,
        to
      );
      res.json(
        success(result.items, {
          pagination: paginationMeta(query.page, query.pageSize, result.totalItems),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getSalesByCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.getSalesByCategory.parseQuery<AnalyticsPageQuery>(req.query);
      const { from, to } = query;
      const result = await analyticsService.getSalesByCategoryPage(
        query.page,
        query.pageSize,
        from,
        to
      );
      res.json(
        success(result.items, {
          pagination: paginationMeta(query.page, query.pageSize, result.totalItems),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getSalesByDistributor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.getSalesByDistributor.parseQuery<AnalyticsPageQuery>(req.query);
      const { from, to } = query;
      const result = await analyticsService.getSalesByDistributorPage(
        query.page,
        query.pageSize,
        from,
        to
      );
      res.json(
        success(result.items, {
          pagination: paginationMeta(query.page, query.pageSize, result.totalItems),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getDeadStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = withDefaultDays(
        contracts.getDeadStock.parseQuery<AnalyticsPageQuery & { days?: number }>(req.query),
        90
      );
      const result = await analyticsService.getDeadStockPage(
        query.days,
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

  async getCustomerLtv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.getCustomerLtv.parseQuery<AnalyticsPageQuery>(req.query);
      const { from, to } = query;
      const result = await analyticsService.getCustomerLtvPage(
        query.page,
        query.pageSize,
        from,
        to
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

  async getHourlyHeatmap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { days } = withDefaultDays(
        contracts.getHourlyHeatmap.parseQuery<{ days?: number }>(req.query),
        30
      );
      const data = await analyticsService.getHourlyHeatmap(days);
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getAbcClassification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.getAbcClassification.parseQuery<AnalyticsPageQuery>(req.query);
      const result = await analyticsService.getAbcClassificationPage(query.page, query.pageSize);
      res.json(
        success(result.data, {
          pagination: paginationMeta(query.page, query.pageSize, result.totalItems),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getReorderSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.getReorderSuggestions.parseQuery<AnalyticsPageQuery>(req.query);
      const result = await analyticsService.getReorderSuggestionsPage(query.page, query.pageSize);
      res.json(
        success(result.items, {
          pagination: paginationMeta(query.page, query.pageSize, result.totalItems),
        })
      );
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
      const query = contracts.getInventorySnapshots.parseQuery<AnalyticsPageQuery>(req.query);
      const result = await analyticsService.getInventorySnapshotsPage(query.page, query.pageSize);
      res.json(
        success(result.items, {
          pagination: paginationMeta(query.page, query.pageSize, result.totalItems),
        })
      );
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
