import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storefrontRequestContracts, bannerSchema } from './schemas';
import { storefrontService } from './service';
import { success } from '../../../http/responses';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = storefrontRequestContracts;

export class StorefrontController {
  async getActiveBanners(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const banners = await storefrontService.getActiveBanners();
      res.json(success(banners));
    } catch (err) {
      next(err);
    }
  }

  async getAllBanners(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const banners = await storefrontService.getAllBanners();
      res.json(success(banners));
    } catch (err) {
      next(err);
    }
  }

  async createBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.createBanner.parseBody<z.infer<typeof bannerSchema>>(req.body);

      const banner = await storefrontService.createBanner(parsed);
      res.status(201).json(success(banner));
    } catch (err) {
      next(err);
    }
  }

  async updateBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.updateBanner.parseParams<{ id: string }>(req.params);
      const parsed = contracts.updateBanner.parseBody<z.infer<typeof bannerSchema>>(req.body);

      const banner = await storefrontService.updateBanner(id as string, parsed);
      if (!banner) {
        throw new PublicError('NOT_FOUND', 'Banner not found');
      }

      res.json(success(banner));
    } catch (err) {
      next(err);
    }
  }

  async deleteBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.deleteBanner.parseParams<{ id: string }>(req.params);
      const deleted = await storefrontService.deleteBanner(id as string);
      if (!deleted) {
        throw new PublicError('NOT_FOUND', 'Banner not found');
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const storefrontController = new StorefrontController();
