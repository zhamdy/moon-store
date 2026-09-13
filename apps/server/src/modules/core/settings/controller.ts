import { Request, Response, NextFunction } from 'express';
import { settingsService } from './service';
import { settingsRequestContracts } from './schemas';
import { success } from '../../../http/responses';

/** Parsed through the contract, so the document and the validator cannot differ (#102). */
const contracts = settingsRequestContracts;

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
      const body = contracts.updateSettings.parseBody<Record<string, string>>(req.body);

      const data = await settingsService.update(body);
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }
}

export const settingsController = new SettingsController();
