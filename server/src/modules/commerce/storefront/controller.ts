import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storefrontService } from './service';
import { success } from '../../../http/responses';
import { PublicError } from '../../../http/errors';
import { getStorage } from '../../../storage';

/**
 * A banner image is either somebody else's absolute URL or a path into this deployment's
 * own media store. The store is asked rather than a `/uploads/` prefix being hard-coded,
 * so a deployment that moves its media keeps accepting the URLs it now hands out.
 */
function isStoredOrAbsoluteUrl(value: string): boolean {
  if (z.string().url().safeParse(value).success) return true;
  return getStorage().keyFromUrl(value) !== null;
}

export const bannerSchema = z.object({
  title: z.string().min(1).max(100),
  subtitle: z.string().max(255).optional(),
  image_url: z
    .string()
    .min(1)
    .max(1000)
    .refine(
      isStoredOrAbsoluteUrl,
      'image_url must be an absolute URL or a path in the media store'
    ),
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
