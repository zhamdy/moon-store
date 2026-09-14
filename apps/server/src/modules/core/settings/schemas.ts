/**
 * The settings module's request contracts (#102).
 */
import { z } from 'zod';
import { defineRequestContract } from '../../../http/requestContracts';
import { STORE_POLICY_SETTING_KEYS } from '../../commerce/catalog/constants';

/** The store policies are served publicly, so their length is bounded. */
export const STORE_POLICY_MAX_LENGTH = 5000;
const storePolicyKeys: ReadonlySet<string> = new Set(Object.values(STORE_POLICY_SETTING_KEYS));

/**
 * Settings are a flat string map, not a fixed record: the table holds whatever keys the
 * application has grown, and the service writes them through unchanged. `z.record` is the
 * honest description of that, and it documents as an object with string values rather
 * than pretending to know the key set.
 */
export const updateSettingsSchema = z
  .record(z.string(), z.string())
  .superRefine((settings, ctx) => {
    for (const [key, value] of Object.entries(settings)) {
      if (storePolicyKeys.has(key) && value.length > STORE_POLICY_MAX_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: STORE_POLICY_MAX_LENGTH,
          type: 'string',
          inclusive: true,
          path: [key],
          message: `${key} must be at most ${STORE_POLICY_MAX_LENGTH} characters`,
        });
      }
    }
  });

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
      'delivery_policy, delivery_policy_en, returns_policy and returns_policy_en are public and capped at 5000 characters.',
    ],
  }),
} as const;

export const settingsContractList = Object.values(settingsRequestContracts);
