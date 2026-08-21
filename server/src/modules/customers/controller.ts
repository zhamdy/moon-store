import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { customerSchema } from '../../../validators/customerSchema';
import { customersService } from './service';

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
      const { search, page = 1, limit = 50 } = req.query;
      const result = await customersService.list({
        search: search as string | undefined,
        page: Number(page),
        limit: Number(limit),
      });

      res.json({
        success: true,
        data: result.rows,
        meta: { total: result.total, page: Number(page), limit: Number(limit) },
      });
    } catch (err) {
      next(err);
    }
  }

  async createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = customerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const customer = await customersService.create(parsed.data);
      res.status(201).json({ success: true, data: customer });
    } catch (err) {
      next(err);
    }
  }

  async updateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = customerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const customer = await customersService.update(req.params.id as string, parsed.data);
      if (!customer) {
        res.status(404).json({ success: false, error: 'Customer not found' });
        return;
      }

      res.json({ success: true, data: customer });
    } catch (err) {
      next(err);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await customersService.getStats(req.params.id as string);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getSales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 25 } = req.query;
      const result = await customersService.getSales(
        req.params.id as string,
        Number(page),
        Number(limit)
      );

      res.json({
        success: true,
        data: result.rows,
        meta: { total: result.total, page: Number(page), limit: Number(limit) },
      });
    } catch (err) {
      next(err);
    }
  }

  async getLoyalty(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customer = await customersService.findById(req.params.id as string);
      if (!customer) {
        res.status(404).json({ success: false, error: 'Customer not found' });
        return;
      }

      const transactions = await customersService.getLoyaltyHistory(req.params.id as string);
      res.json({
        success: true,
        data: {
          points: customer.loyalty_points,
          transactions,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async adjustLoyalty(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const customerId = Number(req.params.id);
      const parsed = loyaltyAdjustSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const newPoints = await customersService.adjustLoyalty(
        customerId,
        parsed.data.points,
        parsed.data.note
      );
      res.json({ success: true, data: { loyalty_points: newPoints } });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async deleteCustomer(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const deleted = await customersService.delete(req.params.id as string);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Customer not found' });
        return;
      }
      res.json({ success: true, data: { message: 'Customer deleted' } });
    } catch (err) {
      _next(err);
    }
  }
}

export const customersController = new CustomersController();
