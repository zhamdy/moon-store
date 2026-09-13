/**
 * The settings module's request contracts (#102).
 */
import { z } from 'zod';
import { defineRequestContract } from '../../../http/requestContracts';

/**
 * Settings are a flat string map, not a fixed record: the table holds whatever keys the
 * application has grown, and the service writes them through unchanged. `z.record` is the
 * honest description of that, and it documents as an object with string values rather
 * than pretending to know the key set.
 */
export const updateSettingsSchema = z.record(z.string(), z.string());

export const settingsRequestContracts = {
  getSettings: defineRequestContract({
    method: 'GET',
    path: '/api/v1/settings',
    operation: 'getSettings',
  }),

  updateSettings: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/settings',
    operation: 'updateSettings',
    body: updateSettingsSchema,
    beyondSchema: [
      'Every value must be a string. A number or boolean is rejected rather than coerced.',
      'The write is a merge: keys absent from the body keep their stored value.',
      'Tax and loyalty live here and are global, so a write changes every till at once.',
    ],
  }),
} as const;

export const settingsContractList = Object.values(settingsRequestContracts);
