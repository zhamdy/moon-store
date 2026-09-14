import type { NextFunction, Request, Response } from 'express';
import { success } from '../../../http/responses';
import {
  catalogRequestContracts as contracts,
  normalizeCatalogProductQuery,
  type CatalogProductListQuery,
} from './schemas';
import { catalogService } from './service';

export class CatalogController {
  async listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listCatalogProducts.parseQuery<CatalogProductListQuery>(req.query);
      const result = await catalogService.listProducts(normalizeCatalogProductQuery(query));
      res.json(success(result.data, result.meta));
    } catch (err) {
      next(err);
    }
  }

  async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      contracts.listCatalogCategories.parseQuery(req.query);
      res.json(success(await catalogService.listCategories()));
    } catch (err) {
      next(err);
    }
  }

  async listCollections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      contracts.listCatalogCollections.parseQuery(req.query);
      res.json(success(await catalogService.listCollections()));
    } catch (err) {
      next(err);
    }
  }

  async getCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      contracts.getCatalogCollection.parseQuery(req.query);
      const { slug } = contracts.getCatalogCollection.parseParams<{ slug: string }>(req.params);
      res.json(success(await catalogService.getCollection(slug)));
    } catch (err) {
      next(err);
    }
  }
}

export const catalogController = new CatalogController();
