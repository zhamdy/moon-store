import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { branchesService } from './service';
import { PublicError } from '../../../http/errors';
import { paginationMeta } from '../../../http/pagination';
import { success } from '../../../http/responses';
import { branchesRequestContracts } from './schemas';
import type { CreateBranchDTO, CreateTransferDTO, TransferFilters } from './types';
import { isUniqueViolation } from '../../../database/constraintErrors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = branchesRequestContracts;

export class BranchesController {
  async getBranches(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branches = await branchesService.list();
      res.json(success(branches));
    } catch (err) {
      next(err);
    }
  }

  async createBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.createBranch.parseBody<CreateBranchDTO>(req.body);
      const branch = await branchesService.create(parsed);
      logAuditFromReq(req, 'create', 'branch', branch.id, { name: parsed.name });
      res.status(201).json(success(branch));
    } catch (err: any) {
      if (err.name === 'ZodError') {
        next(err);
        return;
      }
      if (isUniqueViolation(err)) {
        next(new PublicError('CONFLICT', 'Branch code already exists'));
        return;
      }
      if (err.statusCode) {
        next(
          new PublicError(err.statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', err.message)
        );
        return;
      }
      next(err);
    }
  }

  async updateBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.updateBranch.parseBody<CreateBranchDTO>(req.body);
      const id = Number(req.params.id);
      const branch = await branchesService.update(id, parsed);
      res.json(success(branch));
    } catch (err: any) {
      if (err.name === 'ZodError') {
        next(err);
        return;
      }
      if (isUniqueViolation(err)) {
        next(new PublicError('CONFLICT', 'Branch code already exists'));
        return;
      }
      if (err.statusCode) {
        next(
          new PublicError(err.statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', err.message)
        );
        return;
      }
      next(err);
    }
  }

  async getConsolidated(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await branchesService.getConsolidated();
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getTransfers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listTransfers.parseQuery<TransferFilters>(req.query);
      const transfers = await branchesService.listTransfers(query);
      res.json(
        success(transfers.rows, {
          pagination: paginationMeta(query.page, query.pageSize, transfers.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async createTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const parsed = contracts.createTransfer.parseBody<CreateTransferDTO>(req.body);
      const transfer = await branchesService.createTransfer(parsed, authReq.user!.id);
      res.status(201).json(success(transfer));
    } catch (err: any) {
      if (err.name === 'ZodError') {
        next(err);
        return;
      }
      if (err.statusCode) {
        next(
          new PublicError(err.statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', err.message)
        );
        return;
      }
      next(err);
    }
  }

  async updateTransferStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;
      const result = await branchesService.updateTransferStatus(id, status);
      res.json(success(result));
    } catch (err: any) {
      if (err.statusCode) {
        next(
          new PublicError(err.statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', err.message)
        );
        return;
      }
      next(err);
    }
  }
}

export const branchesController = new BranchesController();
