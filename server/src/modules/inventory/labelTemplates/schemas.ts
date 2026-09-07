/**
 * The label templates module's request contracts (#102).
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';

export const labelTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  width_mm: z.number().positive(),
  height_mm: z.number().positive(),
  layout_json: z.string().min(2, 'Layout JSON is required'),
  is_default: z.boolean().optional(),
});

export type LabelTemplateBody = z.infer<typeof labelTemplateSchema>;

export const labelTemplatesRequestContracts = {
  listLabelTemplates: defineRequestContract({
    method: 'GET',
    path: '/api/v1/label-templates',
    operation: 'listLabelTemplates',
  }),

  createLabelTemplate: defineRequestContract({
    method: 'POST',
    path: '/api/v1/label-templates',
    operation: 'createLabelTemplate',
    body: labelTemplateSchema,
    beyondSchema: [
      '`layout_json` is a JSON document carried as a string, and is stored rather than ' +
        'interpreted: the schema checks only that it is not empty.',
      'Setting `is_default` moves the default off whichever template held it.',
    ],
  }),

  updateLabelTemplate: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/label-templates/{id}',
    operation: 'updateLabelTemplate',
    body: labelTemplateSchema,
    params: pathIdParams(),
    beyondSchema: ['A full replacement, not a merge.'],
  }),

  deleteLabelTemplate: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/label-templates/{id}',
    operation: 'deleteLabelTemplate',
    params: pathIdParams(),
  }),
} as const;

export const labelTemplatesContractList = Object.values(labelTemplatesRequestContracts);
