import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { customersRequestContracts, loyaltyAdjustSchema } from './schemas';
import type { Customer as CustomerBody } from '../../../../validators/customerSchema';
import { customerSalesQuerySchema, type CustomerFilters } from './types';
import { customersService } from './service';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = customersRequestContracts;

export class CustomersController {
  async getCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listCustomers.parseQuery<CustomerFilters>(req.query);
      const result = await customersService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.createCustomer.parseBody<CustomerBody>(req.body);

      const customer = await customersService.create(parsed);
      res.status(201).json(success(customer));
    } catch (err) {
      next(err);
    }
  }

  async updateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.updateCustomer.parseBody<CustomerBody>(req.body);

      const { id } = contracts.updateCustomer.parseParams<{ id: string }>(req.params);
      const customer = await customersService.update(id, parsed);
      if (!customer) {
        throw new PublicError('NOT_FOUND', 'Customer not found');
      }

      res.json(success(customer));
    } catch (err) {
      next(err);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.getCustomerStats.parseParams<{ id: string }>(req.params);
      const data = await customersService.getStats(id);
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getSales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.getCustomerSales.parseQuery<z.infer<typeof customerSalesQuerySchema>>(
        req.query
      );
      const { id } = contracts.getCustomerSales.parseParams<{ id: string }>(req.params);
      const result = await customersService.getSales(
        id,
        query.page,
        query.pageSize,
        query.sortOrder
      );
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getLoyalty(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.getCustomerLoyalty.parseParams<{ id: string }>(req.params);
      const customer = await customersService.findById(id);
      if (!customer) {
        throw new PublicError('NOT_FOUND', 'Customer not found');
      }

      const transactions = await customersService.getLoyaltyHistory(id);
      res.json(
        success({
          points: customer.loyalty_points,
          transactions,
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async adjustLoyalty(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = Number(contracts.adjustLoyalty.parseParams<{ id: string }>(req.params).id);
      const parsed = contracts.adjustLoyalty.parseBody<z.infer<typeof loyaltyAdjustSchema>>(
        req.body
      );

      const newPoints = await customersService.adjustLoyalty(
        customerId,
        parsed.points,
        parsed.note
      );
      res.json(success({ loyalty_points: newPoints }));
    } catch (err) {
      next(err instanceof Error ? new PublicError('VALIDATION_ERROR', err.message) : err);
    }
  }

  async deleteCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.deleteCustomer.parseParams<{ id: string }>(req.params);
      const deleted = await customersService.delete(id);
      if (!deleted) {
        throw new PublicError('NOT_FOUND', 'Customer not found');
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const customersController = new CustomersController();
