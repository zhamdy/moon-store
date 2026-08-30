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
   * Closes the idempotency compatibility window. While false (the default), a mutation
   * without an `Idempotency-Key` behaves exactly as it did before idempotency existed,
   * so an unpatched till keeps working. Flip to true only once every deployed client is
   * confirmed to send the header — it is a config change, not a deploy.
   */
  IDEMPOTENCY_REQUIRED: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
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
