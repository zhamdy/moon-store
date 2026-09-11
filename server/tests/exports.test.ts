/**
 * CSV exports: spreadsheet-formula neutralisation, and the bytes that reach the browser.
 *
 * The numeric exemption is also proven on real PostgreSQL, because node-postgres delivers
 * NUMERIC as a string ("-5.00") while pg-mem delivers a JS number — so only the real driver
 * shows a negative price arriving in the shape a formula check could mistake for a formula.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'path';
import { createPgMemPool } from './support/pgMem';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from './support/realPostgres';
import { getAdminToken, getCashierToken } from './verification/authHelpers';
import { setPool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import errorHandler from '../middleware/errorHandler';
import {
  ExportsRepository,
  ExportsService,
  escapeCsv,
  exportsRouter,
  toCsv,
} from '../src/modules/intelligence/exports';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

const memPool = createPgMemPool();
setPool(memPool);

describe('escapeCsv', () => {
  it.each([
    ['=', '=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
    ['+', '+SUM(A1:A9)', `"'+SUM(A1:A9)"`],
    ['-', '-cmd|calc', `"'-cmd|calc"`],
    ['@', '@SUM(A1)', `"'@SUM(A1)"`],
    ['tab', '\t=1+1', `"'\t=1+1"`],
    ['CR', '\r=1+1', `"'\r=1+1"`],
  ])('prefixes and quotes a cell starting with %s', (_label, input, expected) => {
    expect(escapeCsv(input)).toBe(expected);
  });

  it.each([
    ['a negative JS number', -5, '-5'],
    ['a negative fractional JS number', -2.5, '-2.5'],
    ['a NUMERIC string', '-5.00', '-5.00'],
    ['an integer string', '-5', '-5'],
  ])('leaves %s unprefixed', (_label, input, expected) => {
    expect(escapeCsv(input)).toBe(expected);
  });

  it.each([
    ['arithmetic', '-1+1', `"'-1+1"`],
    ['scientific notation', '-2e3', `"'-2e3"`],
  ])('still prefixes a %s string that only resembles a number', (_label, input, expected) => {
    expect(escapeCsv(input)).toBe(expected);
  });

  it.each([
    ['a comma', 'a,b', '"a,b"'],
    ['a quote', 'say "hi"', '"say ""hi"""'],
    ['a newline', 'a\nb', '"a\nb"'],
    ['a carriage return', 'a\rb', '"a\rb"'],
    ['nothing special', 'plain', 'plain'],
  ])('quotes a field containing %s only when it must', (_label, input, expected) => {
    expect(escapeCsv(input)).toBe(expected);
  });

  it('renders null and undefined as an empty cell', () => {
    expect(escapeCsv(null)).toBe('');
    expect(escapeCsv(undefined)).toBe('');
  });

  it('applies the rule per cell across a row', () => {
    expect(toCsv(['name', 'total'], [{ name: '=1+1', total: '-5.00' }])).toBe(
      `name,total\n"'=1+1",-5.00`
    );
  });
});

describe('GET /api/v1/exports/customers', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    await runMigrationsUp(memPool, MIGRATIONS_DIR);
    await memPool.query('INSERT INTO customers (name, phone) VALUES ($1, $2), ($3, $4)', [
      'سارة أحمد',
      '01000000001',
      '=HYPERLINK("x")',
      '01000000002',
    ]);

    const app = express();
    app.use('/api/v1/exports', exportsRouter);
    app.use(errorHandler);
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const { port } = server.address() as AddressInfo;
    base = `http://127.0.0.1:${port}/api/v1/exports`;
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  );

  it('opens with a UTF-8 BOM, declares the charset, and keeps Arabic intact', async () => {
    const response = await fetch(`${base}/customers`, {
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    });

    expect(response.status).toBe(200);
    const contentType = response.headers.get('content-type') ?? '';
    expect(contentType).toContain('text/csv');
    expect(contentType).toContain('charset=utf-8');

    // Read raw bytes: Response.text() decodes as UTF-8 and silently drops a leading BOM.
    const bytes = Buffer.from(await response.arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    const body = bytes.subarray(3).toString('utf8');
    expect(body.startsWith('id,name,')).toBe(true);
    expect(body).toContain('سارة أحمد');
    expect(body).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('refuses a Cashier', async () => {
    const response = await fetch(`${base}/customers`, {
      headers: { Authorization: `Bearer ${getCashierToken()}` },
    });

    expect(response.status).toBe(403);
  });
});

describeWithPostgres('CSV export over the real driver', () => {
  let pg: RealPostgresHarness;
  let service: ExportsService;

  beforeAll(async () => {
    pg = await setupRealPostgres('exports', { installAsAppPool: false });
    const repo = new ExportsRepository();
    service = new ExportsService({
      getProductsForExport: () => repo.getProductsForExport(pg.pool),
      getSalesForExport: (where, params) => repo.getSalesForExport(where, params, pg.pool),
      getCustomersForExport: () => repo.getCustomersForExport(pg.pool),
    });
    await pg.pool.query(
      "INSERT INTO products (name, sku, price, cost_price) VALUES ('Credit note', 'SKU-NEG', -5.00, 0)"
    );
  });

  afterAll(async () => {
    await pg?.teardown();
  });

  it('receives a negative NUMERIC price as a string and exports it unprefixed', async () => {
    const { rows } = await pg.pool.query<{ price: unknown }>('SELECT price FROM products');
    expect(rows[0].price).toBe('-5.00');

    const { csv } = await service.exportProducts();
    const [header, line] = csv.split('\n');
    const priceColumn = header.split(',').indexOf('price');
    expect(line.split(',')[priceColumn]).toBe('-5.00');
  });
});
