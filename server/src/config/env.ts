import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

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
   * the container and is shared by every instance (a mounted volume or NFS). No cloud
   * driver is bundled, and none of this file names a provider: a driver is a new file
   * implementing `StorageDriver`, configured by adding a case to `createStorageDriver`.
   */
  MEDIA_STORAGE_DRIVER: z.enum(['local']).default('local'),
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

export function resetEnvCache(): void {
  parsedEnv = null;
}
