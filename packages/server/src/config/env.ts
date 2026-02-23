import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  ALTCHA_HMAC_KEY: z.string().min(32),
  API_KEY_ENCRYPTION_SECRET: z.string().min(32),
  TRUSTED_ORIGINS: z.string().transform((s) => s.split(",").map((o) => o.trim())),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  OPENROUTER_API_KEY: z.string().optional(),
  CLAMAV_HOST: z.string().default("localhost"),
  CLAMAV_PORT: z.coerce.number().default(3310),
  REDIS_URL: z.string().url(),
  LIBREOFFICE_SIDECAR_URL: z.string().url().default("http://localhost:4000"),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment configuration:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
