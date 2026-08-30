import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { Pool as PgPool } from 'pg';
import path from 'path';
import { createPgMemPool } from './support/pgMem';
import { parseUserListQuery } from '../src/modules/core/users/types';
import { UsersRepository } from '../src/modules/core/users/repository';
import { runMigrationsUp } from '../src/database/migrate';
import { UsersController } from '../src/modules/core/users/controller';
import { usersService } from '../src/modules/core/users/service';
import usersRouter from '../src/modules/core/users/routes';

describe('Users list contract', () => {
  it('parses canonical pagination, search, role, and sorting', () => {
    expect(
      parseUserListQuery({
        page: '2',
        pageSize: '50',
        search: 'sarah',
        role: 'Cashier',
        sortBy: 'name',
        sortOrder: 'desc',
      })
    ).toEqual({
      page: 2,
      pageSize: 50,
      search: 'sarah',
      role: 'Cashier',
      sortBy: 'name',
      sortOrder: 'desc',
    });
  });

  it('rejects legacy, unknown, and malformed parameters', () => {
    expect(() => parseUserListQuery({ limit: '100' })).toThrow();
    expect(() => parseUserListQuery({ page: '0' })).toThrow();
    expect(() => parseUserListQuery({ role: 'Owner' })).toThrow();
  });
});

describe('Users repository pagination', () => {
  let testPool: PgPool;

  beforeAll(async () => {
    testPool = createPgMemPool();
    await runMigrationsUp(testPool, path.join(__dirname, '../src/database/migrations'));
    await testPool.query(
      `INSERT INTO users (name, email, password_hash, role, created_at)
       VALUES ('Zed', 'zed@example.com', 'hash', 'Admin', '2026-08-20'),
              ('Sarah', 'sarah@example.com', 'hash', 'Cashier', '2026-08-21'),
              ('Sara', 'sara@example.com', 'hash', 'Cashier', '2026-08-21')`
    );
  });

  afterAll(async () => testPool.end());

  it('uses the same filters for rows and totals with deterministic ordering', async () => {
    const result = await new UsersRepository().findPage(
      {
        page: 1,
        pageSize: 10,
        search: 'sar',
        role: 'Cashier',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
      testPool
    );

    expect(result.total).toBe(2);
    expect(result.rows.map((user) => user.name)).toEqual(['Sarah', 'Sara']);
  });
});

describe('Users controller contract', () => {
  it('returns canonical pagination metadata', async () => {
    const list = vi.spyOn(usersService, 'list').mockResolvedValue({ rows: [], total: 0 });
    const json = vi.fn();
    const req = { query: { page: '2', pageSize: '10' } } as unknown as Request;
    const res = { json } as unknown as Response;
    const next = vi.fn();

    await new UsersController().getUsers(req, res, next);

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' })
    );
    expect(json).toHaveBeenCalledWith({
      data: [],
      meta: {
        pagination: {
          page: 2,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Users route precedence', () => {
  it('registers static favorites routes before the parameterized user route', () => {
    const paths = (usersRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);

    expect(paths.indexOf('put /me/favorites')).toBeLessThan(paths.indexOf('put /:id'));
  });
});
