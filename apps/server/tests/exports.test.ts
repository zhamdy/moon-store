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
  SALES_EXPORT_PAGE_SIZE,
  escapeCsv,
  exportsRouter,
  toCsv,
} from '../src/modules/intelligence/exports';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

const memPool = createPgMemPool();
setPool(memPool);

// Written by codepoint, not as a literal byte sequence, so the source file has no stray
// BOM character for a linter to flag as irregular whitespace.
const BOM = String.fromCharCode(0xfeff);

describe('escapeCsv', () => {
  it.each([
    ['=', '=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
    ['+', '+SUM(A1:A9)', `"'+SUM(A1:A9)"`],
    ['-', '-cmd|calc', `"'-cmd|calc"`],
    ['@', '@SUM(A1)', `"'@SUM(A1)"`],
    ['a space before =', ' =HYPERLINK("x")', `"' =HYPERLINK(""x"")"`],
    ['whitespace before +', '  +1+1', `"'  +1+1"`],
    ['|', '|cmd|calc', `"'|cmd|calc"`],
    ['a space before |', ' |cmd', `"' |cmd"`],
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
    ['a space-led plain value', ' Silk Dress', ' Silk Dress'],
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

describe('GET /api/v1/exports/sales', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    await runMigrationsUp(memPool, MIGRATIONS_DIR);
    await memPool.query(
      `INSERT INTO sales (receipt_number, subtotal, tax, total, payment_method, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7), ($8, $9, $10, $11, $12, $13, $14)`,
      [
        'R-IN-RANGE',
        10,
        0,
        10,
        'Cash',
        'completed',
        '2026-01-15T10:00:00Z',
        'R-OUT-OF-RANGE',
        20,
        0,
        20,
        'Cash',
        'completed',
        '2026-02-15T10:00:00Z',
      ]
    );

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

  it('bounds the export to the requested date range', async () => {
    const response = await fetch(`${base}/sales?from=2026-01-01&to=2026-01-31`, {
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    });

    expect(response.status).toBe(200);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    const body = bytes.subarray(3).toString('utf8');
    expect(body).toContain('R-IN-RANGE');
    expect(body).not.toContain('R-OUT-OF-RANGE');
  });

  it('exports everything when no range is given', async () => {
    const response = await fetch(`${base}/sales`, {
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    });

    const body = (await response.text()).replace(new RegExp(`^${BOM}`), '');
    expect(body).toContain('R-IN-RANGE');
    expect(body).toContain('R-OUT-OF-RANGE');
  });

  it('rejects a malformed date', async () => {
    const response = await fetch(`${base}/sales?from=not-a-date`, {
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    });

    expect(response.status).toBe(400);
  });

  it('refuses a Cashier', async () => {
    const response = await fetch(`${base}/sales`, {
      headers: { Authorization: `Bearer ${getCashierToken()}` },
    });

    expect(response.status).toBe(403);
  });
});

describe('ExportsService.exportSalesChunks', () => {
  it('pages through a keyset cursor rather than loading every row at once', async () => {
    // A first page exactly SALES_EXPORT_PAGE_SIZE long, so the generator must issue a
    // second call — carrying the cursor from the first page's last row — rather than
    // assuming a full page is the last one and fetching everything up front.
    const fullPage = Array.from({ length: SALES_EXPORT_PAGE_SIZE }, (_, i) => ({
      id: SALES_EXPORT_PAGE_SIZE - i,
      receipt_number: `R-${SALES_EXPORT_PAGE_SIZE - i}`,
      created_at: `2026-01-${String((SALES_EXPORT_PAGE_SIZE - i) % 28 || 1).padStart(2, '0')}`,
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
    }));
    const secondPage = [
      {
        id: -1,
        receipt_number: 'R-LAST',
        created_at: '2025-12-31',
        subtotal: 0,
        discount: 0,
        tax: 0,
        total: 0,
      },
    ];
    const pages = [fullPage, secondPage];
    const calls: unknown[] = [];
    const service = new ExportsService({
      getProductsForExport: async () => [],
      getCustomersForExport: async () => [],
      getSalesForExportPage: async (filters, cursor, limit) => {
        calls.push({ filters, cursor, limit });
        return pages[calls.length - 1] ?? [];
      },
    });

    const chunks: string[] = [];
    for await (const chunk of service.exportSalesChunks({})) {
      chunks.push(chunk);
    }

    const csv = chunks.join('');
    expect(csv.startsWith(`${BOM}receipt_number,`)).toBe(true);
    expect(csv).toContain('R-1,');
    expect(csv).toContain('R-LAST');

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ cursor: null, limit: SALES_EXPORT_PAGE_SIZE });
    const lastOfFirstPage = fullPage[fullPage.length - 1];
    expect(calls[1]).toMatchObject({
      cursor: { createdAt: lastOfFirstPage.created_at, id: lastOfFirstPage.id },
    });
  });

  it('stops after a short page instead of always issuing one more query', async () => {
    const service = new ExportsService({
      getProductsForExport: async () => [],
      getCustomersForExport: async () => [],
      getSalesForExportPage: async () => [
        {
          id: 1,
          receipt_number: 'R-1',
          created_at: '2026-01-01',
          subtotal: 0,
          discount: 0,
          tax: 0,
          total: 0,
        },
      ],
    });

    const chunks: string[] = [];
    for await (const chunk of service.exportSalesChunks({})) {
      chunks.push(chunk);
    }

    expect(chunks.join('')).toContain('R-1');
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
      getSalesForExportPage: (filters, cursor, limit) =>
        repo.getSalesForExportPage(filters, cursor, limit, pg.pool),
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
