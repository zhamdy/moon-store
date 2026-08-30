import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { newDb } from 'pg-mem';
import { Pool as PgPool } from 'pg';
import path from 'path';
import { parseSessionHistoryQuery } from '../src/modules/pos/register/types';
import { RegisterController } from '../src/modules/pos/register/controller';
import { RegisterService, IRegisterService } from '../src/modules/pos/register/service';
import { RegisterRepository } from '../src/modules/pos/register/repository';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { withTransaction } from '../src/database/transaction';

describe('Register history contract', () => {
  it('strictly parses canonical pagination, filters, and sorting', () => {
    expect(
      parseSessionHistoryQuery({
        page: '2',
        pageSize: '50',
        cashierId: '7',
        from: '2026-08-01',
        to: '2026-08-22',
        sortBy: 'openedAt',
        sortOrder: 'desc',
      })
    ).toEqual({
      page: 2,
      pageSize: 50,
      cashierId: 7,
      from: '2026-08-01',
      to: '2026-08-22',
      sortBy: 'openedAt',
      sortOrder: 'desc',
    });
    expect(() => parseSessionHistoryQuery({ limit: '25' })).toThrow();
    expect(() => parseSessionHistoryQuery({ cashier_id: '7' })).toThrow();
  });

  it('returns canonical pagination metadata', async () => {
    const service = {
      getSessionHistory: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    } as unknown as IRegisterService;
    const json = vi.fn();

    await new RegisterController(service).getSessionHistory(
      { query: { page: '2', pageSize: '10' } } as unknown as Request,
      { json } as unknown as Response,
      vi.fn()
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
  });
});

// ─── Unit 4 (checkout total-parity plan): recordSaleMovement threaded through
// the same transaction client as SalesService.executeSale, so register
// mutations commit/roll back atomically with the sale. ───────────────────────

describe('RegisterService.recordSaleMovement - transaction threading', () => {
  let testPool: PgPool;
  const repo = new RegisterRepository();
  const service = new RegisterService(repo);

  beforeAll(async () => {
    const memDb = newDb({ noAstCoverageCheck: true });
    const { Pool } = memDb.adapters.createPg();
    testPool = new Pool() as unknown as PgPool;
    setPool(testPool);

    const migrationsDir = path.join(__dirname, '../src/database/migrations');
    await runMigrationsUp(testPool, migrationsDir);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM register_movements');
    await testPool.query('DELETE FROM register_sessions');
    await testPool.query('DELETE FROM sales');
    await testPool.query('DELETE FROM users');

    await testPool.query(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
      [1, 'Admin', 'admin@moon.com', 'hash', 'Admin']
    );
    await testPool.query(
      'INSERT INTO sales (id, total, payment_method, cashier_id) VALUES ($1, $2, $3, $4)',
      [1, 100, 'Cash', 1]
    );
  });

  it('is a no-op (does not throw) when the cashier has no open session', async () => {
    await expect(service.recordSaleMovement(1, 1, 100, testPool)).resolves.toBeUndefined();
    const movements = await testPool.query('SELECT * FROM register_movements');
    expect(movements.rows).toHaveLength(0);
  });

  it('accepts a transaction Queryable and records the movement/expected-cash/sale-link atomically', async () => {
    await testPool.query(
      'INSERT INTO register_sessions (cashier_id, opening_float, expected_cash) VALUES ($1, $2, $2)',
      [1, 0]
    );

    await withTransaction(async (client) => {
      await service.recordSaleMovement(1, 1, 100, client);
    }, testPool);

    const movements = await testPool.query(
      'SELECT * FROM register_movements WHERE sale_id = $1',
      [1]
    );
    expect(movements.rows).toHaveLength(1);
    expect(Number(movements.rows[0].amount)).toBe(100);

    const session = await testPool.query('SELECT expected_cash FROM register_sessions');
    expect(Number(session.rows[0].expected_cash)).toBe(100);

    const sale = await testPool.query('SELECT register_session_id FROM sales WHERE id = $1', [1]);
    expect(sale.rows[0].register_session_id).not.toBeNull();
  });

  // Note: a "downstream failure after a successful write rolls the write
  // back" case is intentionally NOT asserted here. The pg-mem test double
  // used across this suite does not actually undo already-applied DML on
  // ROLLBACK (verified independently: a client that BEGINs, INSERTs, then
  // ROLLBACKs still sees the row afterward) -- it only prevents commands
  // that never ran. `withTransaction` still issues the correct
  // BEGIN/COMMIT/ROLLBACK sequence against a real PostgreSQL connection in
  // production; that guarantee comes from PostgreSQL itself, not this
  // in-memory double. What this suite instead proves, faithfully, is that
  // `SalesService.executeSale` never reaches `recordSaleMovement` at all when
  // an earlier step (e.g. split-payment validation) fails -- see
  // `tests/sales.test.ts` "error path: overpayment ... persists nothing,
  // including no register movement".

  it('propagates a failure instead of swallowing it (unlike the previous standalone behavior)', async () => {
    await testPool.query(
      'INSERT INTO register_sessions (cashier_id, opening_float, expected_cash) VALUES ($1, $2, $2)',
      [1, 0]
    );

    // A non-existent sale_id violates the FK on register_movements.sale_id;
    // this must reject, not be caught and silently ignored.
    await expect(service.recordSaleMovement(1, 999999, 100, testPool)).rejects.toBeTruthy();
  });
});
