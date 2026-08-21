import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storefrontService } from './service';

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
      res.json({ success: true, data: banners });
    } catch (err) {
      next(err);
    }
  }

  async getAllBanners(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const banners = await storefrontService.getAllBanners();
      res.json({ success: true, data: banners });
    } catch (err) {
      next(err);
    }
  }

  async createBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = bannerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const banner = await storefrontService.createBanner(parsed.data);
      res.status(201).json({ success: true, data: banner });
    } catch (err) {
      next(err);
    }
  }

  async updateBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = bannerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const banner = await storefrontService.updateBanner(id as string, parsed.data);
      if (!banner) {
        res.status(404).json({ success: false, error: 'Banner not found' });
        return;
      }

      res.json({ success: true, data: banner });
    } catch (err) {
      next(err);
    }
  }

  async deleteBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await storefrontService.deleteBanner(id as string);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Banner not found' });
        return;
      }

      res.json({ success: true, data: { message: 'Banner deleted' } });
    } catch (err) {
      next(err);
    }
  }
}

export const storefrontController = new StorefrontController();
