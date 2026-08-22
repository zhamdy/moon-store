import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storefrontService } from './service';
import { success } from '../../../http/responses';
import { PublicError } from '../../../http/errors';

export const bannerSchema = z.object({
  title: z.string().min(1).max(100),
  subtitle: z.string().max(255).optional(),
  image_url: z.string().url().or(z.string().startsWith('/uploads/')),
  link_url: z.string().max(255).optional(),
  position: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

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
      const parsed = bannerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const banner = await storefrontService.createBanner(parsed.data);
      res.status(201).json(success(banner));
    } catch (err) {
      next(err);
    }
  }

  async updateBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = bannerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const banner = await storefrontService.updateBanner(id as string, parsed.data);
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
      const { id } = req.params;
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
