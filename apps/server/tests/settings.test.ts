import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { SettingsController } from '../src/modules/core/settings/controller';
import { settingsService } from '../src/modules/core/settings/service';

describe('Settings contract', () => {
  it('returns only the canonical data envelope', async () => {
    vi.spyOn(settingsService, 'getAll').mockResolvedValue({ tax_enabled: 'true' });
    const json = vi.fn();
    const next = vi.fn();

    await new SettingsController().getSettings(
      {} as Request,
      { json } as unknown as Response,
      next
    );

    expect(json).toHaveBeenCalledWith({ data: { tax_enabled: 'true' } });
    expect(next).not.toHaveBeenCalled();
  });
});
