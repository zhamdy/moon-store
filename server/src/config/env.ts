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
   * Access-token lifetime, in `jsonwebtoken` duration syntax. Short by design: it is the
   * only credential the API accepts without a database read, so it cannot be revoked
   * before it expires. Shortening it is safe; lengthening it widens the window in which
   * a revoked session keeps working.
   */
  JWT_ACCESS_TTL: z
    .string()
    .regex(
      /^\d+(ms|s|m|h|d|w|y)?$/,
      'JWT_ACCESS_TTL must be a jsonwebtoken duration such as 15m, 900s or 900'
    )
    .default('15m'),
  /**
   * Refresh-session lifetime, in whole days. Expressed as a number rather than a
   * duration string because the same value has to produce both the JWT `exp` and the
   * `refresh_tokens.expires_at` column, and two independently-parsed duration strings
   * are exactly how those two drift apart.
   */
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().max(365).default(7),
  /**
   * How long a just-rotated refresh token still answers, in seconds.
   *
   * Rotation makes the previous token invalid the instant its successor is issued, and
   * treating any use of an invalidated token as theft is the whole point of reuse
   * detection. But two browser tabs sharing one cookie both hit `/auth/refresh` the
   * moment the access token expires, and a till retrying after a dropped response
   * presents the same token twice. Without a window those honest cases revoke the user's
   * whole session family — a spurious logout on the most ordinary interaction there is.
   *
   * Inside the window the presentation is treated as a replay: it rotates the family's
   * current head instead of branching or revoking, so the session stays single-lineage
   * and the caller gets a usable token. Outside it, reuse is reuse. Set to 0 for strict
   * no-grace semantics; the ceiling keeps the tolerated theft window small.
   */
  REFRESH_ROTATION_GRACE_SECONDS: z.coerce.number().int().min(0).max(120).default(10),
  /**
   * `SameSite` for the refresh cookie. `lax` is the default and is what the current
   * same-site client needs. `none` is only meaningful cross-site and forces `Secure` on,
   * because browsers reject `SameSite=None` without it.
   */
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
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
