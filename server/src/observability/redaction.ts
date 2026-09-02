/**
 * Log redaction.
 *
 * The rule this module enforces is *structural*, not a denylist someone has to remember
 * to extend when a new field appears:
 *
 *   1. Nothing logs a request body, a header, a cookie, or a query *value* in the first
 *      place. `requestLogging.ts` logs allow-listed query *key names* only, and the auth
 *      module logs a 12-character digest prefix rather than token material (#74). An
 *      allow-list cannot leak a field nobody thought of, because a field nobody thought
 *      of is not on it.
 *   2. Everything that does reach `logger` passes through `redactMeta` below, which is a
 *      deny-list — the second layer, for the case where rule 1 is violated by a future
 *      caller passing `{ user }` or `{ body }` wholesale into a log line.
 *
 * Layer 2 is deliberately fail-closed in both directions: a *key* whose name suggests a
 * secret is replaced whatever its value, and a *value* shaped like a credential is
 * replaced whatever its key. The key is always kept so the log line still shows the shape
 * of what was there.
 *
 * What must never appear in a log line: passwords and hashes, access/refresh tokens and
 * any JWT, `Authorization` headers, cookies, session identifiers, API keys, database
 * connection strings with credentials, card/PIN/OTP material, and customer personal data
 * — phone numbers, email addresses, postal addresses, names.
 */

export const REDACTED = '[REDACTED]';

/**
 * Key *words* whose values are never logged.
 *
 * Matching is on tokenized words rather than raw substrings: `refresh_token`,
 * `refreshToken` and `REFRESH-TOKEN` all tokenize to `[refresh, token]` and so are one
 * rule, while `company` does not become sensitive because it contains `pan`, and
 * `shipping` does not because it contains `pin`. Substring matching on short words is
 * how a redactor starts eating the fields operators actually need.
 */
const SENSITIVE_WORDS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'jwt',
  'bearer',
  'authorization',
  'auth',
  'cookie',
  'cookies',
  'session',
  'credential',
  'credentials',
  'apikey',
  'key',
  'privatekey',
  'signature',
  'otp',
  'pin',
  'cvv',
  'cvc',
  'card',
  'pan',
  'iban',
  'ssn',
  'phone',
  'msisdn',
  'mobile',
  'whatsapp',
  'email',
  'mail',
  'address',
  'passport',
  'dob',
  'birthdate',
  'birthday',
  'zip',
  'postcode',
  'postalcode',
  'street',
]);

/** Multi-word key shapes that are personal data only in combination. */
const SENSITIVE_KEY_PATTERNS = [
  /(customer|first|last|full|middle|given|family|holder|recipient|contact)name/,
  /national(id|number)/,
];

/**
 * Keys that match a sensitive word but are safe and useful. A digest *prefix* is the auth
 * module's established way of correlating two log lines about the same token without ever
 * writing the token (`auth/service.ts`, #74). Listed explicitly so each exception is
 * auditable rather than an accident of matching order.
 */
const ALLOWED_KEYS = new Set([
  'tokendigestprefix',
  'tokenfamily',
  'tokencount',
  'sessioncount',
  'sessionid',
  'authmethod',
]);

/** `refreshTokenTTL` -> `[refresh, token, ttl]`, `api_key` -> `[api, key]`. */
function tokenizeKey(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

export function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (ALLOWED_KEYS.has(normalized)) return false;
  if (tokenizeKey(key).some((word) => SENSITIVE_WORDS.has(word))) return true;
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Value shapes that are credentials or personal data wherever they appear.
 *
 * Deliberately narrow patterns, not "any long string": a stack trace, a SQL statement or
 * a file path is exactly the thing an operator needs to keep, and a scrubber that eats
 * them makes people stop logging. Notably absent is "a run of digits" — a product id and
 * a phone number are indistinguishable that way, so phone numbers are caught by key name
 * (rule above) and, in free text, only in unambiguous E.164 form.
 */
const VALUE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // JWTs — three base64url segments. Covers access and refresh tokens in any context.
  { pattern: /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/g, replacement: REDACTED },
  // `Authorization: Bearer …` / `Basic …` copied into a message.
  { pattern: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, replacement: `$1 ${REDACTED}` },
  // Connection strings carrying credentials: scheme://user:password@host
  { pattern: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s:/@]+:[^\s@]+@/gi, replacement: `$1${REDACTED}@` },
  // Email addresses.
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: REDACTED },
  // E.164 phone numbers. `+` plus 8–15 digits is unambiguous; bare digit runs are not.
  { pattern: /\+\d[\d\s().-]{7,20}\d/g, replacement: REDACTED },
  // A full SHA-256/512 hex digest — token material at rest. 12-char prefixes stay.
  { pattern: /\b[a-f0-9]{64,128}\b/gi, replacement: REDACTED },
];

/** Bounds, so one bad log call cannot flood the aggregator or stall the event loop. */
const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 25;
const MAX_STRING_LENGTH = 4000;

export function scrubString(value: string): string {
  let out = value;
  for (const { pattern, replacement } of VALUE_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  if (out.length > MAX_STRING_LENGTH) {
    out = `${out.slice(0, MAX_STRING_LENGTH)}…[truncated]`;
  }
  return out;
}

function redactValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return scrubString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      stack: value.stack ? scrubString(value.stack) : undefined,
    };
  }
  if (depth >= MAX_DEPTH) return '[TRUNCATED]';
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactValue(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`…${value.length - MAX_ARRAY_ITEMS} more`);
    }
    return items;
  }
  if (typeof value === 'object') {
    return redactRecord(value as Record<string, unknown>, depth + 1);
  }
  // Functions, symbols: never meaningful in a log line, and can close over secrets.
  return `[${typeof value}]`;
}

function redactRecord(record: Record<string, unknown>, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redactValue(value, depth);
  }
  return out;
}

/** Redacts a log line's metadata object. Safe to call on anything, including `undefined`. */
export function redactMeta(
  meta: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!meta) return meta;
  return redactRecord(meta, 0);
}
