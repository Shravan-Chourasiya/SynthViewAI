import * as z from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_VERSION: z.string().default("1.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  POSTGRES_URI: z.string().url(),
  REDIS_URI: z.string().url(),
  JWT_SECRET: z.string().min(64).max(512),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:3000")
    .transform((val) => val.split(",").map((s) => s.trim()))
    .pipe(z.array(z.string().url())),
  COOKIE_DOMAIN: z.string().optional(),
  API_VERSION: z.string(),
  GMAIL_USER_EMAIL: z.string().email(),
  GMAIL_CLIENT_ID: z.string(),
  GMAIL_CLIENT_SECRET: z.string(),
  GMAIL_REFRESH_TOKEN: z.string(),
  GMAIL_APP_PASSWORD: z.string().min(1).optional(),
  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().min(1).default("llama-3.1-8b-instant"),
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_MODEL: z.string().min(1).default("mistral-small-latest"),
});

export default envSchema;
