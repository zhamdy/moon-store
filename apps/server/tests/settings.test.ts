import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import path from 'path';
import type { Pool as PgPool } from 'pg';
import type { Request, Response } from 'express';
import { SettingsController } from '../src/modules/core/settings/controller';
import { settingsService } from '../src/modules/core/settings/service';
import { STORE_POLICY_MAX_LENGTH } from '../src/modules/core/settings/schemas';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { startHttpApp, type HttpHarness } from './support/httpApp';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

describe('Settings contract', () => {
  it('returns only the canonical data envelope', async () => {
    const spy = vi.spyOn(settingsService, 'getAll').mockResolvedValue({ tax_enabled: 'true' });
    const json = vi.fn();
    const next = vi.fn();

    await new SettingsController().getSettings(
      {} as Request,
      { json } as unknown as Response,
      next
    );

    expect(json).toHaveBeenCalledWith({ data: { tax_enabled: 'true' } });
    expect(next).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// Through HTTP: the cap lives in the schema, so a service-level test would miss it.
describe('PUT /api/v1/settings store policy length', () => {
  let testPool: PgPool;
  let http: HttpHarness;

  beforeAll(async () => {
    testPool = createPgMemPool();
    setPool(testPool);
    await runMigrationsUp(testPool, MIGRATIONS_DIR);
    http = await startHttpApp();
  });

  afterAll(async () => {
    await http.close();
    await closePool();
  });

  it('rejects a public policy longer than the cap with a 400 VALIDATION_ERROR', async () => {
    const r = await http.request('PUT', '/api/v1/settings', {
      delivery_policy_en: 'x'.repeat(STORE_POLICY_MAX_LENGTH + 1),
    });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts a policy at the cap and leaves other keys uncapped', async () => {
    const r = await http.request('PUT', '/api/v1/settings', {
      returns_policy: 'x'.repeat(STORE_POLICY_MAX_LENGTH),
      receipt_footer: 'y'.repeat(STORE_POLICY_MAX_LENGTH + 1),
    });
    expect(r.status).toBe(200);
  });

  it('still accepts a normal tax and loyalty write', async () => {
    const r = await http.request('PUT', '/api/v1/settings', {
      tax_rate: '14',
      loyalty_enabled: 'true',
    });
    expect(r.status).toBe(200);
  });
});
