import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { Queryable } from '../src/database/transaction';
import { StorefrontRepository } from '../src/modules/commerce/storefront/repository';
import { StorefrontController } from '../src/modules/commerce/storefront/controller';
import { storefrontService } from '../src/modules/commerce/storefront/service';

describe('Storefront config', () => {
  describe('StorefrontRepository', () => {
    it('reads storefront_config_* rows out of the settings table and strips the prefix', async () => {
      const query = vi.fn().mockResolvedValue({
        rows: [
          { key: 'storefront_config_store_name', value: 'MOON' },
          { key: 'storefront_config_hero_title', value: 'Discover Your Style' },
        ],
      });

      const config = await new StorefrontRepository().getConfig({ query } as unknown as Queryable);

      expect(config).toEqual({ store_name: 'MOON', hero_title: 'Discover Your Style' });
      expect(query.mock.calls[0][0]).toContain('settings WHERE key LIKE');
      expect(query.mock.calls[0][1]).toEqual(['storefront_config_%']);
    });

    it('writes each field under the storefront_config_ prefix, never the bare key', async () => {
      const query = vi.fn().mockResolvedValue({ rows: [] });

      await new StorefrontRepository().upsertConfig({ store_name: 'MOON Fashion & Style' }, {
        query,
      } as unknown as Queryable);

      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('INSERT INTO settings');
      expect(params).toEqual(['storefront_config_store_name', 'MOON Fashion & Style']);
    });

    it('skips undefined fields rather than writing them as literal "undefined"', async () => {
      const query = vi.fn().mockResolvedValue({ rows: [] });

      await new StorefrontRepository().upsertConfig({ store_name: 'MOON', hero_title: undefined }, {
        query,
      } as unknown as Queryable);

      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('StorefrontController', () => {
    it('returns the config the service reads, under the canonical envelope', async () => {
      vi.spyOn(storefrontService, 'getConfig').mockResolvedValue({ store_name: 'MOON' });
      const json = vi.fn();

      await new StorefrontController().getConfig(
        {} as Request,
        { json } as unknown as Response,
        vi.fn()
      );

      expect(json).toHaveBeenCalledWith({ data: { store_name: 'MOON' } });
    });

    it('parses the body through the contract before handing it to the service', async () => {
      const updateConfig = vi
        .spyOn(storefrontService, 'updateConfig')
        .mockResolvedValue({ store_name: 'MOON Fashion & Style' });
      const json = vi.fn();

      await new StorefrontController().updateConfig(
        { body: { store_name: 'MOON Fashion & Style' } } as Request,
        { json } as unknown as Response,
        vi.fn()
      );

      expect(updateConfig).toHaveBeenCalledWith({ store_name: 'MOON Fashion & Style' });
      expect(json).toHaveBeenCalledWith({ data: { store_name: 'MOON Fashion & Style' } });
    });

    it('rejects a key the config form does not offer', async () => {
      const next = vi.fn();

      await new StorefrontController().updateConfig(
        { body: { not_a_real_field: 'x' } } as unknown as Request,
        { json: vi.fn() } as unknown as Response,
        next
      );

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.name).toBe('ZodError');
    });
  });
});
