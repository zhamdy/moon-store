/**
 * Set-and-restore for the global settings rows (D5).
 *
 * Only `tax-loyalty.spec.ts` may use this, and only from the serial `pos-settings`
 * project. Tax and loyalty are not per-sale inputs: `CartPanel` reads them from
 * `appSettings`, and `PUT /api/v1/settings` writes rows every worker shares. A write from
 * a parallel worker silently changes the totals every other worker is asserting on.
 *
 * **A settings write is not visible to an already-loaded page.** The server holds no
 * cache, so a `PUT` is instantly visible over HTTP — but the client reads settings through
 * `useApiQuery(['settings'])` under a five-minute `staleTime`, so a page loaded before the
 * write keeps rendering and submitting under the *old* settings. The consequence is
 * exactly inverted from what a reader expects: the inclusive-tax case, the one most likely
 * to be silently wrong, becomes the one most likely to silently *pass*. Every write here
 * is therefore followed by a reload before any assertion.
 */
import type { APIRequestContext } from '@playwright/test';
import { API_BASE } from './seed';
import { SETTINGS_BASELINE } from '../support/settingsBaseline';

export type SettingsMap = Record<string, string>;

export async function readSettings(request: APIRequestContext): Promise<SettingsMap> {
  const response = await request.get(`${API_BASE}/settings`);
  if (!response.ok()) {
    throw new Error(`GET settings failed: ${response.status()} ${await response.text()}`);
  }
  return ((await response.json()) as { data: SettingsMap }).data;
}

/** Admin-only. A non-Admin token must fail loudly rather than proceed under old settings. */
export async function writeSettings(
  request: APIRequestContext,
  values: SettingsMap
): Promise<void> {
  const response = await request.put(`${API_BASE}/settings`, { data: values });
  if (!response.ok()) {
    throw new Error(`PUT settings failed: ${response.status()} ${await response.text()}`);
  }
}

/**
 * Restores every baseline key.
 *
 * Written to run in `afterAll` **including on failure**: a spec that dies mid-file without
 * restoring leaves the database in inclusive-tax mode for the next run, and that failure
 * is far more expensive to diagnose than whatever bug was being chased.
 */
export async function restoreBaseline(request: APIRequestContext): Promise<void> {
  await writeSettings(request, { ...SETTINGS_BASELINE });
}
