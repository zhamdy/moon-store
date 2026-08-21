import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { settingsService } from './service';

const updateSettingsSchema = z.record(z.string(), z.string());

export class SettingsController {
  async getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await settingsService.getAll();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid settings format' });
        return;
      }

      const data = await settingsService.update(parsed.data);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const settingsController = new SettingsController();
