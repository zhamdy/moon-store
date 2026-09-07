import { Request, Response, NextFunction } from 'express';
import { labelTemplatesRequestContracts, type LabelTemplateBody } from './schemas';
import { labelTemplatesService } from './service';
import { success } from '../../../http/responses';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = labelTemplatesRequestContracts;

export class LabelTemplatesController {
  async getLabelTemplates(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = await labelTemplatesService.findAll();
      res.json(success(templates));
    } catch (err) {
      next(err);
    }
  }

  async createLabelTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.createLabelTemplate.parseBody<LabelTemplateBody>(req.body);
      const template = await labelTemplatesService.create(parsed);
      res.status(201).json(success(template));
    } catch (err) {
      next(err);
    }
  }

  async updateLabelTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.updateLabelTemplate.parseParams<{ id: string }>(req.params);
      const parsed = contracts.updateLabelTemplate.parseBody<LabelTemplateBody>(req.body);

      const result = await labelTemplatesService.update(id as string, parsed);
      if (!result.success) {
        throw new PublicError('NOT_FOUND', result.error);
      }

      res.json(success(result.data));
    } catch (err) {
      next(err);
    }
  }

  async deleteLabelTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.deleteLabelTemplate.parseParams<{ id: string }>(req.params);
      const result = await labelTemplatesService.delete(id as string);
      if (!result.success) {
        throw new PublicError('NOT_FOUND', result.error);
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const labelTemplatesController = new LabelTemplatesController();
