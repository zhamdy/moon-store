import { Request, Response, NextFunction } from 'express';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { bundlesService } from './service';
import { bundlesRequestContracts, type BundleBody } from './schemas';
import { normalizeBundleListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = bundlesRequestContracts;

export class BundlesController {
  async getBundles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = normalizeBundleListQuery(contracts.listBundles.parseQuery(req.query));
      const result = await bundlesService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getBundleById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.getBundle.parseParams<{ id: string }>(req.params);
      const bundle = await bundlesService.findById(id);
      if (!bundle) {
        throw new PublicError('NOT_FOUND', 'Bundle not found');
      }

      res.json(success(bundle));
    } catch (err) {
      next(err);
    }
  }

  async createBundle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.createBundle.parseBody<BundleBody>(req.body);
      const bundle = await bundlesService.create(parsed);

      logAuditFromReq(req, 'create', 'bundle', bundle.id, { name: parsed.name });
      res.status(201).json(success(bundle));
    } catch (err) {
      next(err);
    }
  }

  async updateBundle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.updateBundle.parseParams<{ id: string }>(req.params);
      const parsed = contracts.updateBundle.parseBody<BundleBody>(req.body);

      const result = await bundlesService.update(id as string, parsed);
      if (!result.success) {
        throw new PublicError('NOT_FOUND', result.error);
      }

      logAuditFromReq(req, 'update', 'bundle', Number(id));
      res.json(success(result.data));
    } catch (err) {
      next(err);
    }
  }

  async deleteBundle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.deleteBundle.parseParams<{ id: string }>(req.params);
      const result = await bundlesService.delete(id as string);
      if (!result.success) {
        throw new PublicError('NOT_FOUND', result.error);
      }

      logAuditFromReq(req, 'delete', 'bundle', Number(id));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const bundlesController = new BundlesController();
