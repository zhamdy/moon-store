import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { newDb } from 'pg-mem';
import { Pool as PgPool, PoolClient } from 'pg';
import { setPool, closePool } from '../../src/database/pool';
import { withTransaction } from '../../src/database/transaction';

describe('PostgreSQL withTransaction Helper', () => {
  let memPool: PgPool;

  beforeEach(() => {
    const memDb = newDb();
    memDb.public.none(`
      CREATE TABLE test_items (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);
    const { Pool } = memDb.adapters.createPg();
    memPool = new Pool() as unknown as PgPool;
    setPool(memPool);
  });

  afterEach(async () => {
    await closePool();
  });

  it('should rollback transaction and release client when callback throws an error', async () => {
    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') {
          return { rows: [] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as PgPool;

    await expect(
      withTransaction(async (client) => {
        await client.query('INSERT INTO test_items (name) VALUES ($1)', ['Item C']);
        throw new Error('Simulated failure');
      }, mockPool)
    ).rejects.toThrow('Simulated failure');

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('should call BEGIN, COMMIT, and release on success', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as PgPool;

    const result = await withTransaction(async (client) => {
      await client.query('INSERT INTO test_items (name) VALUES ($1)', ['Item A']);
      return 'success_val';
    }, mockPool);

    expect(result).toBe('success_val');
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});
