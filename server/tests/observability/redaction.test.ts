/**
 * Redaction is an acceptance criterion of #45 ("sensitive fields are redacted and
 * verified by tests"), so these tests are the specification of what may never appear in a
 * log line rather than a check that a function returns a string.
 *
 * Two directions are pinned, because a redactor that only does one of them is a redactor
 * that leaks: a *key* that names a secret is redacted whatever it holds, and a *value*
 * shaped like a credential is redacted whatever it is called. And the negative cases —
 * stack traces, SQL, ids, durations — matter as much: a scrubber that eats diagnostics is
 * one people work around by not logging.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { REDACTED, isSensitiveKey, redactMeta, scrubString } from '../../src/observability/redaction';
import logger from '../../lib/logger';

afterEach(() => vi.restoreAllMocks());

describe('sensitive key detection', () => {
  it.each([
    'password',
    'Password',
    'password_hash',
    'passwordHash',
    'accessToken',
    'access_token',
    'refreshToken',
    'REFRESH-TOKEN',
    'jwt',
    'authorization',
    'Authorization',
    'cookie',
    'setCookie',
    'apiKey',
    'api_key',
    'privateKey',
    'jwtSecret',
    'otp',
    'pin',
    'cvv',
    'cardNumber',
    'iban',
    'phone',
    'customerPhone',
    'whatsappNumber',
    'email',
    'customerEmail',
    'address',
    'shippingAddress',
    'customerName',
    'nationalId',
    'dob',
  ])('treats %s as sensitive', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it.each([
    // Substring matching on short words is how a redactor starts eating useful fields:
    // "company" contains "pan", "shipping" contains "pin", "author" contains "auth".
    'company',
    'companyId',
    'shippingStatus',
    'author',
    'name',
    'status',
    'duration_ms',
    'productId',
    'quantity',
    'stack',
    'errorType',
    'panel',
    // The auth module's established safe correlator (#74): a digest prefix, never the token.
    'tokenDigestPrefix',
  ])('leaves %s alone', (key) => {
    expect(isSensitiveKey(key)).toBe(false);
  });
});

describe('redactMeta', () => {
  it('replaces sensitive values but keeps the key, so the shape stays readable', () => {
    const out = redactMeta({ email: 'sarah@moon.com', role: 'Cashier' });
    expect(out).toEqual({ email: REDACTED, role: 'Cashier' });
  });

  it('redacts through nesting and arrays', () => {
    const out = redactMeta({
      user: { id: 7, role: 'Admin', password: 'hunter2', phone: '+971500000000' },
      items: [{ sku: 'ABC', customerEmail: 'x@y.com' }],
    }) as Record<string, Record<string, unknown>>;

    expect(out.user).toEqual({ id: 7, role: 'Admin', password: REDACTED, phone: REDACTED });
    expect(out.items).toEqual([{ sku: 'ABC', customerEmail: REDACTED }]);
  });

  it('redacts credential-shaped values even under an innocuous key', () => {
    const jwtLike = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MX0.c2lnbmF0dXJlLXZhbHVl';
    const out = redactMeta({
      note: `header was Bearer ${jwtLike}`,
      dsn: 'postgresql://postgres:supersecret@db.internal:5432/moon',
      contact: 'reach sarah@moon.com or +971 50 123 4567',
      digest: 'a'.repeat(64),
    }) as Record<string, string>;

    expect(out.note).not.toContain(jwtLike);
    expect(out.note).toContain(REDACTED);
    expect(out.dsn).toBe(`postgresql://${REDACTED}@db.internal:5432/moon`);
    expect(out.contact).not.toContain('sarah@moon.com');
    expect(out.contact).not.toContain('971 50 123 4567');
    expect(out.digest).toBe(REDACTED);
  });

  it('keeps a 12-character digest prefix, the auth module\'s safe correlator', () => {
    const out = redactMeta({ tokenDigestPrefix: 'a1b2c3d4e5f6' }) as Record<string, string>;
    expect(out.tokenDigestPrefix).toBe('a1b2c3d4e5f6');
  });

  it('preserves diagnostics a scrubber must not eat', () => {
    const stack = 'Error: nope\n    at handler (/srv/app/server/src/modules/sales/service.ts:42:9)';
    const out = redactMeta({
      stack,
      sql: 'SELECT id FROM products WHERE stock < $1',
      path: '/api/v1/products/:id',
      duration_ms: 1234567,
      status: 500,
    }) as Record<string, unknown>;

    expect(out.stack).toBe(stack);
    expect(out.sql).toBe('SELECT id FROM products WHERE stock < $1');
    expect(out.path).toBe('/api/v1/products/:id');
    expect(out.duration_ms).toBe(1234567);
  });

  it('bounds depth, array length and string length so one bad call cannot flood the log', () => {
    const shallowEnough = { a: { b: { c: { d: { e: 'still visible' } } } } };
    expect(JSON.stringify(redactMeta(shallowEnough))).toContain('still visible');

    const deep = { a: { b: { c: { d: { e: { f: { g: 'too deep' } } } } } } };
    expect(JSON.stringify(redactMeta(deep))).toContain('[TRUNCATED]');

    const wide = redactMeta({ items: Array.from({ length: 100 }, (_, i) => i) }) as {
      items: unknown[];
    };
    expect(wide.items).toHaveLength(26);
    expect(wide.items[25]).toBe('…75 more');

    const long = redactMeta({ blob: 'x'.repeat(9000) }) as { blob: string };
    expect(long.blob.endsWith('…[truncated]')).toBe(true);
    expect(long.blob.length).toBeLessThan(5000);
  });

  it('does not choke on null, undefined, dates, errors or functions', () => {
    const out = redactMeta({
      nothing: null,
      missing: undefined,
      when: new Date('2026-01-01T00:00:00.000Z'),
      err: new Error('boom'),
      fn: () => undefined,
    }) as Record<string, unknown>;

    expect(out.nothing).toBeNull();
    expect(out.when).toBe('2026-01-01T00:00:00.000Z');
    expect((out.err as { message: string }).message).toBe('boom');
    expect(out.fn).toBe('[function]');
  });
});

describe('logger redaction', () => {
  it('scrubs both the message and the metadata of every line it emits', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logger.error('login failed for sarah@moon.com', {
      password: 'hunter2',
      attempt: 3,
    });

    const line = spy.mock.calls[0][0] as string;
    expect(line).not.toContain('sarah@moon.com');
    expect(line).not.toContain('hunter2');
    expect(line).toContain('"attempt":3');
  });
});

describe('scrubString', () => {
  it('leaves an ordinary message untouched', () => {
    expect(scrubString('MOON Fashion API running on port 3001')).toBe(
      'MOON Fashion API running on port 3001'
    );
  });
});
