import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { settingsService } from './service';
import { success } from '../../../http/responses';

const updateSettingsSchema = z.record(z.string(), z.string());

export class SettingsController {
  async getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await settingsService.getAll();
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const data = await settingsService.update(parsed.data);
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }
}

export const settingsController = new SettingsController();
