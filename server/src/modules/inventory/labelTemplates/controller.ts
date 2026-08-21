import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { labelTemplatesService } from './service';

const labelTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  width_mm: z.number().positive(),
  height_mm: z.number().positive(),
  layout_json: z.string().min(2, 'Layout JSON is required'),
  is_default: z.boolean().optional(),
});

export class LabelTemplatesController {
  async getLabelTemplates(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = await labelTemplatesService.findAll();
      res.json({ success: true, data: templates });
    } catch (err) {
      next(err);
    }
  }

  async createLabelTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = labelTemplateSchema.parse(req.body);
      const template = await labelTemplatesService.create(parsed);
      res.status(201).json({ success: true, data: template });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      next(err);
    }
  }

  async updateLabelTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = labelTemplateSchema.parse(req.body);

      const result = await labelTemplatesService.update(id as string, parsed);
      if (!result.success) {
        res.status(404).json({ success: false, error: result.error });
        return;
      }

      res.json({ success: true, data: result.data });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      next(err);
    }
  }

  async deleteLabelTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await labelTemplatesService.delete(id as string);
      if (!result.success) {
        res.status(404).json({ success: false, error: result.error });
        return;
      }

      res.json({ success: true, data: { message: 'Template deleted' } });
    } catch (err) {
      next(err);
    }
  }
}

export const labelTemplatesController = new LabelTemplatesController();
