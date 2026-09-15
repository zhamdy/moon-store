import { CHECKOUT_DRAFT_KEY, CHECKOUT_DRAFT_VERSION } from '../constants';
import {
  CHECKOUT_FIELDS,
  CHECKOUT_LIMITS,
  type CheckoutFormValues,
} from '../schemas/checkout-form';

/**
 * The typed-details draft (plan 2026-09-15-002, CO-16; owner decision 2026-09-15):
 * `sessionStorage` only, so it lasts the browsing session (including a reopened or duplicated
 * tab), never across visits. Contact and address strings only: no payment data, tokens, prices
 * or the quote. Validated field by field before use. Never logged, never in a URL. Storage that
 * throws means no draft, never an error.
 */

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type CheckoutDraft = Partial<CheckoutFormValues>;

export type ParsedDraft = { ok: true; draft: CheckoutDraft } | { ok: false };

/**
 * A field survives only as a known key holding a string within its length limit; content
 * validity (a half-typed phone) is not required, since the shopper sees their own text and the
 * normal error on blur or Continue. Unknown keys, including `__proto__`, are never read.
 */
export function parseDraft(raw: string): ParsedDraft {
  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  if (typeof envelope !== 'object' || envelope === null || Array.isArray(envelope)) {
    return { ok: false };
  }
  const { version, draft } = envelope as { version?: unknown; draft?: unknown };
  if (version !== CHECKOUT_DRAFT_VERSION) return { ok: false };
  if (typeof draft !== 'object' || draft === null || Array.isArray(draft)) return { ok: false };

  const accepted: CheckoutDraft = {};
  for (const field of CHECKOUT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(draft, field)) continue;
    const value = (draft as Record<string, unknown>)[field];
    if (typeof value === 'string' && value.length <= CHECKOUT_LIMITS[field]) {
      accepted[field] = value;
    }
  }
  return { ok: true, draft: accepted };
}

/** The stored draft, or null. A malformed or other-version draft is removed. */
export function readDraft(storage: DraftStorage | null): CheckoutDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CHECKOUT_DRAFT_KEY);
    if (raw === null) return null;
    const parsed = parseDraft(raw);
    if (!parsed.ok) {
      storage.removeItem(CHECKOUT_DRAFT_KEY);
      return null;
    }
    return parsed.draft;
  } catch {
    return null;
  }
}

/** Writes only non-empty fields; an all-empty form removes the draft. */
export function writeDraft(storage: DraftStorage | null, values: CheckoutFormValues): void {
  if (!storage) return;
  const draft: CheckoutDraft = {};
  for (const field of CHECKOUT_FIELDS) {
    if (values[field] !== '') draft[field] = values[field];
  }
  try {
    if (Object.keys(draft).length === 0) {
      storage.removeItem(CHECKOUT_DRAFT_KEY);
    } else {
      storage.setItem(
        CHECKOUT_DRAFT_KEY,
        JSON.stringify({ version: CHECKOUT_DRAFT_VERSION, draft })
      );
    }
  } catch {
    // Quota or disabled storage: the draft is a convenience, so nothing is reported.
  }
}

/** For a future successful commerce outcome (CO-17). */
export function clearDraft(storage: DraftStorage | null): void {
  try {
    storage?.removeItem(CHECKOUT_DRAFT_KEY);
  } catch {
    // Same as above.
  }
}

/** `window.sessionStorage`, or null where the accessor itself throws or there is no window. */
export function browserDraftStorage(): DraftStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
