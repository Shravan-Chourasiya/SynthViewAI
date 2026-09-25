import * as z from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_VERSION: z.string().default("1.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  POSTGRES_URI: z.string().url(),
  // Upper bound on concurrent Postgres connections held by the pool. One interview
  // turn is a chain of short sequential queries, so this is a concurrency ceiling
  // rather than a load limit — raise it when more candidates are answering at the
  // same moment, and keep it clear of the server's own max_connections.
  POSTGRES_POOL_MAX: z.coerce.number().int().positive().max(200).default(20),
  REDIS_URI: z.string().url(),
  JWT_SECRET: z.string().min(64).max(512),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:3000")
    .transform((val) => val.split(",").map((s) => s.trim()))
    .pipe(z.array(z.string().url())),
  COOKIE_DOMAIN: z.string().optional(),
  API_VERSION: z.string(),
  // ── Email (Brevo SMTP relay) ────────────────────────────────────────────────
  // Every value is required. Registration, OTP verification, password reset and
  // email change all depend on mail being deliverable, so a missing or malformed
  // value has to stop the process at boot instead of degrading into a platform
  // where sign-up silently cannot complete.
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  // Must be a sender (or domain) verified on the Brevo account.
  EMAIL_FROM: z.string().email(),
  EMAIL_FROM_NAME: z.string().min(1).default("SynthView AI"),
  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().min(1).default("llama-3.1-8b-instant"),
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_MODEL: z.string().min(1).default("mistral-small-latest"),
  // Embeddings are a separate Mistral model from the chat completion model —
  // mistral-embed has no chat equivalent and vice versa.
  MISTRAL_EMBED_MODEL: z.string().min(1).default("mistral-embed"),
});

export default envSchema;
