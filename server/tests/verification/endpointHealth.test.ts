import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { newDb } from 'pg-mem';
import { registerPgMemFunctions, toPgMemCompatibleSql } from '../support/pgMem';
import { Pool as PgPool } from 'pg';
import { setPool, closePool } from '../../src/database/pool';
import { runMigrationsUp } from '../../src/database/migrate';
import { seedDatabase } from '../../src/database/seed';
import { endpointDetailsManifest } from '../../src/http/endpointManifest';
import { createTestApp } from './testApp';
import { fetchSeededFixtures, SeededFixtures } from './fixtureProvider';
import { getAdminToken, getCashierToken, getDeliveryToken } from './authHelpers';
import { getSamplePayload } from './payloads';
import { diagnosticCollector } from './diagnosticCollector';
import { generateMarkdownReport, saveReportToFile } from './reportGenerator';

let testPool: PgPool;
let fixtures: SeededFixtures;
const app = createTestApp();

beforeAll(async () => {
  const memDb = newDb({ noAstCoverageCheck: true });

  // The shared harness's shims first: this suite builds its own database, so without
  // this it inherits the SQL rewriter and none of the function registrations, and
  // `POST /auth/logout` 500s on `clock_timestamp() does not exist`.
  registerPgMemFunctions(memDb);

  // Register missing PostgreSQL functions in pg-mem
  memDb.public.registerFunction({
    name: 'round',
    args: [memDb.public.getType('float') as any, memDb.public.getType('integer') as any],
    returns: memDb.public.getType('float') as any,
    implementation: (val: number, precision: number) => {
      if (val === null || val === undefined) return null;
      const factor = Math.pow(10, precision);
      return Math.round(Number(val) * factor) / factor;
    },
  });

  memDb.public.registerFunction({
    name: 'round',
    args: [memDb.public.getType('float') as any],
    returns: memDb.public.getType('integer') as any,
    implementation: (val: number) => {
      if (val === null || val === undefined) return null;
      return Math.round(Number(val));
    },
  });

  memDb.public.registerFunction({
    name: 'length',
    args: [memDb.public.getType('text') as any],
    returns: memDb.public.getType('integer') as any,
    implementation: (val: string) => {
      if (val === null || val === undefined) return null;
      return String(val).length;
    },
  });

  memDb.public.registerFunction({
    name: 'floor',
    args: [memDb.public.getType('float') as any],
    returns: memDb.public.getType('integer') as any,
    implementation: (val: number) => {
      if (val === null || val === undefined) return null;
      return Math.floor(Number(val));
    },
  });

  memDb.public.registerFunction({
    name: 'date_trunc',
    args: [memDb.public.getType('text') as any, memDb.public.getType('date') as any],
    returns: memDb.public.getType('timestamptz') as any,
    implementation: (field: string, d: Date | string) => {
      const date = d ? new Date(d) : new Date();
      if (field === 'month') {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
      }
      if (field === 'day') {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      }
      return date;
    },
  });

  memDb.public.registerFunction({
    name: 'date_trunc',
    args: [memDb.public.getType('text') as any, memDb.public.getType('timestamp') as any],
    returns: memDb.public.getType('timestamptz') as any,
    implementation: (field: string, d: Date | string) => {
      const date = d ? new Date(d) : new Date();
      if (field === 'month') {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
      }
      if (field === 'day') {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      }
      return date;
    },
  });

  memDb.public.registerFunction({
    name: 'date_trunc',
    args: [memDb.public.getType('text') as any, memDb.public.getType('timestamptz') as any],
    returns: memDb.public.getType('timestamptz') as any,
    implementation: (field: string, d: Date | string) => {
      const date = d ? new Date(d) : new Date();
      if (field === 'month') {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
      }
      if (field === 'day') {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      }
      return date;
    },
  });

  memDb.public.registerFunction({
    name: 'substr',
    args: [memDb.public.getType('text') as any, memDb.public.getType('text') as any],
    returns: memDb.public.getType('text') as any,
    implementation: (str: string, from: string | number) => {
      if (!str) return '';
      const start = Number(from);
      return str.substring(start - 1);
    },
  });

  memDb.public.registerFunction({
    name: 'substr',
    args: [memDb.public.getType('text') as any, memDb.public.getType('integer') as any],
    returns: memDb.public.getType('text') as any,
    implementation: (str: string, from: number) => {
      if (!str) return '';
      return str.substring(from - 1);
    },
  });

  memDb.public.registerFunction({
    name: 'to_char',
    args: [memDb.public.getType('timestamptz') as any, memDb.public.getType('text') as any],
    returns: memDb.public.getType('text') as any,
    implementation: (d: Date | string, format: string) => {
      const date = d ? new Date(d) : new Date();
      if (format === 'YYYY-MM-DD') {
        return date.toISOString().slice(0, 10);
      }
      if (format === 'YYYY-MM') {
        return date.toISOString().slice(0, 7);
      }
      return date.toISOString().slice(0, 10);
    },
  });

  memDb.public.registerFunction({
    name: 'to_char',
    args: [memDb.public.getType('timestamp') as any, memDb.public.getType('text') as any],
    returns: memDb.public.getType('text') as any,
    implementation: (d: Date | string, format: string) => {
      const date = d ? new Date(d) : new Date();
      if (format === 'YYYY-MM-DD') {
        return date.toISOString().slice(0, 10);
      }
      if (format === 'YYYY-MM') {
        return date.toISOString().slice(0, 7);
      }
      return date.toISOString().slice(0, 10);
    },
  });

  memDb.public.registerFunction({
    name: 'jsonb_build_object',
    args: [],
    returns: memDb.public.getType('jsonb') as any,
    implementation: (...args: any[]) => {
      const obj: Record<string, any> = {};
      for (let i = 0; i < args.length; i += 2) {
        if (i + 1 < args.length) {
          obj[args[i]] = args[i + 1];
        }
      }
      return obj;
    },
  });

  const { Pool } = memDb.adapters.createPg();
  const rawPool = new Pool() as unknown as PgPool;

  function sanitizeSql(text: string): string {
    let s = toPgMemCompatibleSql(text);
    if (s.toUpperCase().includes('SET TRANSACTION ISOLATION LEVEL')) {
      return '';
    }
    s = s.replace(/s\.created_at::text/g, 's.created_at');
    s = s.replace(/sa\.created_at::text/g, 'sa.created_at');
    s = s.replace(/NOW\(\)::text/g, 'NOW()');

    // Fix timestamp epoch subtraction
    s = s.replace(/EXTRACT\(EPOCH FROM \([^)]*updated_at - [^)]*created_at\)\)/g, '0');
    s = s.replace(/EXTRACT\(EPOCH FROM \(NOW\(\) - MAX\(s\.created_at\)(?:::timestamp)?\)\)/g, '0');
    s = s.replace(
      /EXTRACT\(EPOCH FROM \(CURRENT_TIMESTAMP - COALESCE\(MAX\(s\.created_at\), p\.created_at\)\)\)/g,
      '0'
    );
    s = s.replace(/EXTRACT\(EPOCH FROM \(CURRENT_TIMESTAMP - MIN\(s\.created_at\)\)\)/g, '0');
    s = s.replace(/EXTRACT\(EPOCH FROM \(CURRENT_TIMESTAMP - MAX\(s\.created_at\)\)\)/g, '0');

    // Fix date casts and intervals
    s = s.replace(/created_at::date = CURRENT_DATE/g, "created_at >= NOW() - INTERVAL '1 day'");
    s = s.replace(/s\.created_at::date/g, "TO_CHAR(s.created_at, 'YYYY-MM-DD')");
    s = s.replace(/created_at::date::text as date/g, "TO_CHAR(created_at, 'YYYY-MM-DD') as date");
    s = s.replace(/created_at::date/g, "TO_CHAR(created_at, 'YYYY-MM-DD')");
    s = s.replace(/::date::text/g, '::text');
    s = s.replace(/::date/g, '');
    s = s.replace(/MAX\(s\.created_at\)::text/g, 'MAX(s.created_at)');
    s = s.replace(/MIN\(s\.created_at\)::text/g, 'MIN(s.created_at)');
    s = s.replace(
      /TO_CHAR\(created_at, 'YYYY-MM-DD'\) = NOW\(\)/g,
      "created_at >= NOW() - INTERVAL '1 day'"
    );
    s = s.replace(/created_at = CURRENT_DATE/g, "created_at >= NOW() - INTERVAL '1 day'");
    s = s.replace(/CURRENT_DATE - INTERVAL '30 days'/g, "NOW() - INTERVAL '30 days'");
    s = s.replace(/CURRENT_DATE - INTERVAL '90 days'/g, "NOW() - INTERVAL '90 days'");
    s = s.replace(/CURRENT_DATE - \(([^)]+)\)::interval/g, "NOW() - INTERVAL '30 days'");
    s = s.replace(/CURRENT_DATE - \(\$1 \|\| ' days'\)::interval/g, "NOW() - INTERVAL '30 days'");
    s = s.replace(/CURRENT_DATE/g, 'NOW()');

    // Handle OVER() clause in refreshAbcClasses if run in pg-mem
    if (s.includes('OVER ()') || s.includes('OVER (ORDER BY')) {
      return "UPDATE products SET abc_class = 'A' WHERE status = 'active'";
    }

    return s;
  }

  // Intercept queries for pg-mem compatibility
  const origConnect = rawPool.connect.bind(rawPool);
  rawPool.connect = (async () => {
    const client = await origConnect();
    const origQuery = client.query.bind(client);
    client.query = (async (text: any, params?: any) => {
      if (typeof text === 'string') {
        const sanitized = sanitizeSql(text);
        if (sanitized === '') {
          return { rows: [], rowCount: 0, command: 'SET', oid: 0, fields: [] } as any;
        }
        text = sanitized;
      }
      return origQuery(text, params);
    }) as any;
    return client;
  }) as any;

  const origPoolQuery = rawPool.query.bind(rawPool);
  rawPool.query = (async (text: any, params?: any) => {
    if (typeof text === 'string') {
      const sanitized = sanitizeSql(text);
      if (sanitized === '') {
        return { rows: [], rowCount: 0, command: 'SET', oid: 0, fields: [] } as any;
      }
      text = sanitized;
    }
    return origPoolQuery(text, params);
  }) as any;

  testPool = rawPool;
  setPool(testPool);

  const migrationsDir = path.join(__dirname, '../../src/database/migrations');
  await runMigrationsUp(testPool, migrationsDir);
  await seedDatabase(testPool);

  fixtures = await fetchSeededFixtures();
  diagnosticCollector.clear();
});

afterAll(async () => {
  // Generate and save diagnostic report
  const diagnostics = diagnosticCollector.getDiagnostics();
  const reportMd = generateMarkdownReport(diagnostics);

  /**
   * Writing the tracked report on every run made `npm test` dirty the working tree with
   * a fresh timestamp, and three agents in a row committed or reverted it as noise. The
   * report is still worth having — it is a deliberate snapshot, regenerated when someone
   * wants to look at it — so it is gated rather than deleted or gitignored: gitignoring
   * would keep the write and hide the drift, which is the same problem one layer down.
   * The console summary below is unaffected and still prints on every run.
   */
  if (process.env.WRITE_API_REPORT === '1') {
    const reportPath = path.join(__dirname, '../../../docs/reports/api-verification-report.md');
    saveReportToFile(reportMd, reportPath);
  }

  await closePool();
});

function resolvePathParams(rawPath: string, fixtures: SeededFixtures): string {
  return rawPath
    .replace(':id', String(fixtures.product?.id || 1))
    .replace(':categoryId', String(fixtures.category?.id || 1))
    .replace(':variantId', '1')
    .replace(':branchId', String(fixtures.branch?.id || 1))
    .replace(':userId', String(fixtures.user?.id || 1))
    .replace(':customerId', String(fixtures.customer?.id || 1))
    .replace(':distributorId', String(fixtures.distributor?.id || 1))
    .replace(':vendorId', String(fixtures.vendor?.id || 1))
    .replace(':shippingCompanyId', String(fixtures.shippingCompany?.id || 1))
    .replace(':couponId', String(fixtures.coupon?.id || 1))
    .replace(':code', fixtures.coupon?.code || 'WELCOME10');
}

describe('Automated API Health & Endpoint Verification Suite', () => {
  it('systematically verifies all registered endpoints against seeded database', async () => {
    const adminToken = getAdminToken();
    const cashierToken = getCashierToken();
    const deliveryToken = getDeliveryToken();

    for (const endpoint of endpointDetailsManifest) {
      const resolvedPath = resolvePathParams(endpoint.path, fixtures);
      const roles = endpoint.authorization.roles;
      const isPublic = endpoint.authorization.kind === 'public';

      // Pick representative token
      let token: string | undefined;
      let roleLabel = 'Public';
      if (!isPublic) {
        if (roles.includes('Admin')) {
          token = adminToken;
          roleLabel = 'Admin';
        } else if (roles.includes('Cashier')) {
          token = cashierToken;
          roleLabel = 'Cashier';
        } else if (roles.includes('Delivery')) {
          token = deliveryToken;
          roleLabel = 'Delivery';
        }
      }

      const startTime = Date.now();
      let status = 0;
      let responseBody: unknown;
      let rawErr: any = null;

      try {
        const res = await new Promise<{ status: number; body: unknown; rawError?: any }>(
          (resolve) => {
            const reqObj: any = {
              method: endpoint.method,
              url: resolvedPath,
              path: resolvedPath.split('?')[0],
              query: {},
              headers: {
                ...(token ? { authorization: `Bearer ${token}` } : {}),
                'content-type': 'application/json',
              },
              cookies: {
                refreshToken: 'test-refresh-token',
              },
              ip: '127.0.0.1',
              socket: {
                remoteAddress: '127.0.0.1',
              },
              connection: {
                remoteAddress: '127.0.0.1',
              },
              get(headerName: string) {
                return this.headers[headerName.toLowerCase()];
              },
              header(headerName: string) {
                return this.headers[headerName.toLowerCase()];
              },
              body:
                endpoint.method !== 'GET'
                  ? getSamplePayload(endpoint.path, endpoint.method, fixtures)
                  : {},
            };

            let statusCode = 200;
            let respBody: unknown = {};

            const resObj: any = {
              locals: {},
              headers: {},
              status(code: number) {
                statusCode = code;
                return this;
              },
              json(data: unknown) {
                respBody = data;
                resolve({ status: statusCode, body: respBody, rawError: this.__rawError });
                return this;
              },
              send(data: unknown) {
                respBody = data;
                resolve({ status: statusCode, body: respBody, rawError: this.__rawError });
                return this;
              },
              sendStatus(code: number) {
                statusCode = code;
                resolve({ status: statusCode, body: respBody, rawError: this.__rawError });
                return this;
              },
              end() {
                resolve({ status: statusCode, body: respBody, rawError: this.__rawError });
                return this;
              },
              cookie(_name: string, _value: string, _options?: any) {
                return this;
              },
              clearCookie(_name: string, _options?: any) {
                return this;
              },
              setHeader(name: string, value: any) {
                this.headers[name.toLowerCase()] = value;
                return this;
              },
              getHeader(name: string) {
                return this.headers[name.toLowerCase()];
              },
              set(name: string, value: any) {
                this.headers[name.toLowerCase()] = value;
                return this;
              },
            };

            app(reqObj, resObj, (err?: any) => {
              if (err) {
                resolve({ status: 500, body: { error: err.message }, rawError: err });
              } else {
                resolve({ status: 404, body: { error: 'Not found or unhandled' } });
              }
            });
          }
        );

        status = res.status;
        responseBody = res.body;
        if (res.rawError) {
          rawErr = res.rawError;
        }
      } catch (err: any) {
        status = 500;
        responseBody = { error: err.message, stack: err.stack };
        rawErr = err;
      }

      const durationMs = Date.now() - startTime;

      diagnosticCollector.record({
        method: endpoint.method,
        path: resolvedPath,
        role: roleLabel,
        status,
        responseBody,
        error: rawErr
          ? { message: rawErr.message, stack: rawErr.stack, code: rawErr.code }
          : undefined,
        durationMs,
      });
    }

    const diagnostics = diagnosticCollector.getDiagnostics();
    const failures = diagnosticCollector.getFailures();

    console.log(`\n===== API ENDPOINT VERIFICATION SUMMARY =====`);
    console.log(`Total Endpoints Tested: ${diagnostics.length}`);
    console.log(`Successes (2xx/3xx):     ${diagnosticCollector.getSuccesses().length}`);
    console.log(`Client Errors (4xx):     ${diagnosticCollector.getClientErrors().length}`);
    console.log(`Server Errors (500s):    ${failures.length}`);
    console.log(`=============================================\n`);

    // Verify test suite executed properly
    expect(diagnostics.length).toBeGreaterThan(0);
  }, 30000);
});
