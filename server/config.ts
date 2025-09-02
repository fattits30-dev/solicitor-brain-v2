import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(8),
  SESSION_SECRET: z.string().min(8),
  OLLAMA_BASE_URL: z.string().url().optional(),
  PORT: z
    .string()
    .transform((v) => parseInt(v, 10))
    .optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export const env = (() => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Log sanitized errors and throw (avoid printing raw env values)
    // This file intentionally fails fast if required env vars are missing.
    // Use a local .env (not committed) for development and set secrets in CI.
    // Do not log raw environment values.
    console.error('Invalid environment configuration:', parsed.error.format());
    throw new Error('Invalid environment configuration');
  }

  return parsed.data as Env;
})();
