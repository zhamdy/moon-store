import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/** Minimum length of each `CATALOG_SERVER_TOKEN` entry (32 bytes, e.g. `openssl rand -hex 32`). */
export const CATALOG_SERVER_TOKEN_MIN_BYTES = 32;

/** The configured entries of a comma-list token variable, trimmed, empties dropped. */
export function splitCatalogServerTokens(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z
    .string()
    .optional()
    .default('postgresql://postgres:postgres@localhost:5432/moon_store'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  /**
   * Auth token and cookie knobs, resolved by `src/modules/core/auth/config.ts`.
   *
   * Raw strings here for the same reason as the rate-limit ceilings below: a typo must
   * fall back to the safe value and be warned about, not fail the whole environment parse
   * and take a shop offline over a stray character. The resolvers own the defaults, the
   * bounds and the warnings.
   *
   * `JWT_ACCESS_TTL` is `jsonwebtoken` duration syntax (`15m`, `900s`, `900`) and is
   * capped: an access token is accepted on its signature alone, so nothing — logout,
   * global revocation, reuse detection — can reach one before it expires.
   *
   * `JWT_REFRESH_TTL_DAYS` is a whole number of days. It is a count rather than a
   * duration string because the same value has to produce both the JWT `exp` and the
   * `refresh_tokens.expires_at` column, and two independently-parsed duration strings are
   * exactly how those two drift apart.
   *
   * `REFRESH_ROTATION_GRACE_SECONDS` is how long a just-rotated refresh token still
   * answers, with the token that rotation already issued. Rotation invalidates the
   * previous token immediately and treating any later use of it as theft is the point of
   * reuse detection — but two tabs sharing one cookie both refresh the instant the access
   * token expires, and a client that never received its response asks again. Without a
   * window those honest cases revoke the user's whole session family. `0` selects strict
   * no-grace semantics.
   */
  JWT_ACCESS_TTL: z.string().optional(),
  JWT_REFRESH_TTL_DAYS: z.string().optional(),
  REFRESH_ROTATION_GRACE_SECONDS: z.string().optional(),
  /**
   * `SameSite` for the refresh cookie: `lax` (default), `strict` or `none`, matched
   * case-insensitively — the attribute is spelled `SameSite=None` everywhere an operator
   * has seen it. `none` forces `Secure` on, because browsers reject that combination.
   */
  COOKIE_SAMESITE: z.string().optional(),
  /** Optional `Domain` for the refresh cookie. Unset means host-only, which is stricter. */
  COOKIE_DOMAIN: z.string().optional(),
  /**
   * Closes the idempotency compatibility window. While false (the default), a mutation
   * without an `Idempotency-Key` behaves exactly as it did before idempotency existed,
   * so an unpatched till keeps working. Flip to true only once every deployed client is
   * confirmed to send the header — it is a config change, not a deploy.
   */
  IDEMPOTENCY_REQUIRED: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  /**
   * Ceilings for the two rate limiters, resolved by `src/http/rateLimits.ts`. Kept as
   * raw strings here so a typo falls back to today's value instead of failing the whole
   * environment parse. They are deliberately separate variables: the global ceiling and
   * the credential brute-force ceiling guard different things, and one variable raising
   * both would let a config written to unblock a test suite silently relax the login
   * limit too.
   */
  RATE_LIMIT_MAX: z.string().optional(),
  AUTH_RATE_LIMIT_MAX: z.string().optional(),
  /**
   * How many reverse proxies sit in front of this API, resolved by
   * `src/http/rateLimits.ts`. Unset means "none", which is exactly today's behaviour:
   * Express leaves `trust proxy` off and `req.ip` is the socket address.
   *
   * Raw string for the same reason as the ceilings above — a typo must fall back to the
   * safe value rather than fail the whole environment parse — and because the accepted
   * values are not one type: a hop count, a list of trusted addresses, or the
   * deliberately-discouraged `true`.
   */
  TRUST_PROXY: z.string().optional(),
  /**
   * Public catalog limiter ceilings, resolved by `src/http/rateLimits.ts` like the two
   * above (raw strings; a typo falls back and is warned about). `CATALOG_RATE_LIMIT_MAX` is
   * per IP; `CATALOG_SERVER_RATE_LIMIT_MAX` is the one shared bucket for requests carrying a
   * valid `X-Catalog-Server-Token` (the storefront's server-side fetches).
   */
  CATALOG_RATE_LIMIT_MAX: z.string().optional(),
  CATALOG_SERVER_RATE_LIMIT_MAX: z.string().optional(),
  /**
   * Comma list of storefront-server tokens (current and next, for rotation). Unlike the
   * ceilings this one fails the parse: a short token is a guessable key to a high-ceiling
   * bucket, not a typo with a safe fallback. The message never echoes the value.
   */
  CATALOG_SERVER_TOKEN: z
    .string()
    .optional()
    .superRefine((raw, ctx) => {
      if (raw === undefined) return;
      const short = splitCatalogServerTokens(raw).filter(
        (entry) => Buffer.byteLength(entry, 'utf8') < CATALOG_SERVER_TOKEN_MIN_BYTES
      );
      if (short.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `every CATALOG_SERVER_TOKEN entry must be at least ${CATALOG_SERVER_TOKEN_MIN_BYTES} bytes (${short.length} too short)`,
        });
      }
    }),
  /**
   * How often the `service_metrics` snapshot line is emitted, in milliseconds, resolved
   * by `src/observability/metrics.ts`. `0` disables it. Values under a second are raised
   * to a second — a sub-second snapshot is a log flood, not a metric.
   *
   * There is no `/metrics` endpoint to configure: the log stream is the metrics
   * transport, so that an operator needs nothing beyond the aggregator they already run.
   * See the module comment for the reasoning and for what was rejected.
   */
  METRICS_LOG_INTERVAL_MS: z.string().optional(),
  /**
   * Where uploaded media lives, resolved by `src/storage/index.ts`. Every default here
   * reproduces the pre-abstraction behaviour exactly — the filesystem under
   * `server/uploads`, served at `/uploads` — so an unconfigured deployment keeps serving
   * the URLs already in the database.
   *
   * `local` is the documented development option and the compatibility default. It is
   * durable in a deployment only when `MEDIA_LOCAL_ROOT` points at storage that outlives
   * the container and is shared by every instance (a mounted volume or NFS).
   *
   * `s3` targets any S3-compatible store — AWS S3, Cloudflare R2, DigitalOcean Spaces,
   * MinIO. They share one API, so the driver is written against the protocol rather than
   * a vendor: pick the bucket with `MEDIA_S3_*` below and set an endpoint if it is not
   * AWS. Credentials come from the environment and never from a committed file.
   */
  MEDIA_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  /**
   * S3 settings. All optional here rather than required-when-s3, because this schema is
   * parsed for every process including ones that never touch media; `createStorageDriver`
   * is where a missing bucket becomes a loud boot failure, and it names what is missing.
   */
  MEDIA_S3_BUCKET: z.string().optional(),
  MEDIA_S3_REGION: z.string().optional(),
  /** Non-AWS stores (R2, Spaces, MinIO) need their endpoint; AWS infers it from region. */
  MEDIA_S3_ENDPOINT: z.string().optional(),
  /**
   * Omit both to let the SDK's default chain find credentials — an instance role, a
   * container role, `~/.aws`. That is the better posture where it is available, and the
   * reason these are optional rather than required.
   */
  MEDIA_S3_ACCESS_KEY_ID: z.string().optional(),
  MEDIA_S3_SECRET_ACCESS_KEY: z.string().optional(),
  /**
   * MinIO and some self-hosted gateways address buckets as a path segment rather than a
   * subdomain. Harmless on AWS, required on those.
   */
  MEDIA_S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** Root directory for the `local` driver. Defaults to `server/uploads`. */
  MEDIA_LOCAL_ROOT: z.string().optional(),
  /**
   * URL prefix `publicUrl` puts in front of a key. Defaults to `/uploads`, the exact shape
   * of every `image_url` already stored. Point it at a CDN once media is fronted by one;
   * rows written before the change keep resolving through the `/uploads` mount.
   */
  MEDIA_PUBLIC_BASE_URL: z.string().optional(),
  /**
   * How long an unreferenced object must have sat in the store before the orphan sweep may
   * delete it. The window exists because an upload is written before the row that
   * references it: without it, a sweep landing between the two would delete a live image.
   */
  MEDIA_ORPHAN_MIN_AGE_HOURS: z.coerce.number().min(1).default(24),
  CLIENT_URL: z.string().optional().default('http://localhost:5173'),
  ALLOWED_ORIGINS: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env | null = null;

export function getEnv(): Env {
  if (!parsedEnv) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`Environment validation failed: ${issues}`);
    }
    parsedEnv = result.data;
  }
  return parsedEnv;
}

/** The origin of an absolute http(s) URL, or null for anything else (relative, junk). */
function absoluteHttpOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * The origin the public catalog makes relative image URLs absolute on (KD-3).
 *
 * Derived from `MEDIA_PUBLIC_BASE_URL` only -- never from a request's Host or
 * X-Forwarded-Host, because catalog responses are publicly cached and a forged host would
 * poison them. Stored relative URLs already carry the `/uploads/...` path, so only the
 * origin is used. Outside production an unset or relative base falls back to this
 * process's own `http://localhost:<PORT>`, which serves `/uploads`. In production that
 * fallback would be a lie, so it throws; `assertProductionEnv` makes boot refuse first.
 */
export function resolveMediaPublicOrigin(env: Env = getEnv()): string {
  const origin = absoluteHttpOrigin(env.MEDIA_PUBLIC_BASE_URL);
  if (origin) return origin;
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'MEDIA_PUBLIC_BASE_URL must be an absolute http(s) URL in production: the public ' +
        'catalog builds image URLs from it and will not guess from the request host.'
    );
  }
  return `http://localhost:${env.PORT}`;
}

/**
 * Production-only boot checks that would otherwise surface as a failed request much later.
 * Called by `index.ts` before the app is built, not inside `getEnv()`: several tests read
 * the environment under `NODE_ENV=production` to exercise cookie and seed rules, and a
 * parse-level rule would fail every one of them for an unrelated variable.
 */
export function assertProductionEnv(env: Env = getEnv()): void {
  if (env.NODE_ENV !== 'production') return;
  resolveMediaPublicOrigin(env);
}

export function resetEnvCache(): void {
  parsedEnv = null;
}
