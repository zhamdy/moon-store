import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { customerSchema } from '../../../../validators/customerSchema';
import { customersService } from './service';
import { parseCustomerListQuery, parseCustomerSalesQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

const loyaltyAdjustSchema = z.object({
  points: z
    .number()
    .int()
    .refine((v) => v !== 0, 'Points cannot be zero'),
  note: z.string().min(1, 'Note is required'),
});

export class CustomersController {
  async getCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseCustomerListQuery(req.query);
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
      const parsed = customerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const customer = await customersService.create(parsed.data);
      res.status(201).json(success(customer));
    } catch (err) {
      next(err);
    }
  }

  async updateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = customerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const customer = await customersService.update(req.params.id as string, parsed.data);
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
      const data = await customersService.getStats(req.params.id as string);
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getSales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseCustomerSalesQuery(req.query);
      const result = await customersService.getSales(
        req.params.id as string,
        query.page,
        query.pageSize
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
      const customer = await customersService.findById(req.params.id as string);
      if (!customer) {
        throw new PublicError('NOT_FOUND', 'Customer not found');
      }

      const transactions = await customersService.getLoyaltyHistory(req.params.id as string);
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
      const customerId = Number(req.params.id);
      const parsed = loyaltyAdjustSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const newPoints = await customersService.adjustLoyalty(
        customerId,
        parsed.data.points,
        parsed.data.note
      );
      res.json(success({ loyalty_points: newPoints }));
    } catch (err) {
      next(err instanceof Error ? new PublicError('VALIDATION_ERROR', err.message) : err);
    }
  }

  async deleteCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await customersService.delete(req.params.id as string);
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
