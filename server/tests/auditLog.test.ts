import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool as PgPool } from 'pg';
import path from 'path';
import { createPgMemPool } from './support/pgMem';
import { parseAuditLogListQuery } from '../src/modules/core/auditLog/types';
import { AuditLogRepository } from '../src/modules/core/auditLog/repository';
import { runMigrationsUp } from '../src/database/migrate';

describe('Audit Log list contract', () => {
  it('parses canonical filters and pagination', () => {
    expect(
      parseAuditLogListQuery({
        page: '2',
        pageSize: '50',
        userId: '3',
        action: 'update',
        entityType: 'product',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-22',
        search: 'sku',
      })
    ).toEqual({
      page: 2,
      pageSize: 50,
      userId: 3,
      action: 'update',
      entityType: 'product',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-22',
      search: 'sku',
    });
  });

  it('rejects legacy and unknown query names', () => {
    expect(() => parseAuditLogListQuery({ limit: '50' })).toThrow();
    expect(() => parseAuditLogListQuery({ entity_type: 'product' })).toThrow();
  });
});

describe('Audit Log repository', () => {
  let testPool: PgPool;

  beforeAll(async () => {
    testPool = createPgMemPool();
    await runMigrationsUp(testPool, path.join(__dirname, '../src/database/migrations'));
    await testPool.query(
      `INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details, created_at)
       VALUES (1, 'Admin', 'update', 'product', 'SKU-1', '{"name":"Silk"}', '2026-08-21'),
              (1, 'Admin', 'create', 'user', '2', '{}', '2026-08-20')`
    );
  });

  afterAll(async () => testPool.end());

  it('filters the real audit_log table and exposes bounded filter vocabularies', async () => {
    const repository = new AuditLogRepository();
    const result = await repository.findLogs(
      {
        page: 1,
        pageSize: 50,
        entityType: 'product',
        search: 'silk',
      },
      testPool
    );

    expect(result.total).toBe(1);
    expect(result.rows[0].entity_id).toBe('SKU-1');
    expect(await repository.findDistinctActions(testPool)).toEqual(['create', 'update']);
    expect(await repository.findDistinctEntityTypes(testPool)).toEqual(['product', 'user']);
  });
});
