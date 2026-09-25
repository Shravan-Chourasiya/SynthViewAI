import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import { sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export type PgDb = ReturnType<typeof drizzle>;

interface PgSingleton {
  pool: Pool;
  db: PgDb;
}

let instance: PgSingleton | undefined;

function createInstance(): PgSingleton {
  const poolConfig: PoolConfig = {
    connectionString: env.POSTGRES_URI,
    ssl: { rejectUnauthorized: true },
    // Concurrency, not throughput. Every query in this app is short and indexed,
    // so 5 connections is plenty for total load — but it is a hard ceiling on how
    // many requests can be *in flight*, and one interview turn is a chain of 6–10
    // sequential queries. A handful of candidates answering at the same moment was
    // therefore enough to queue behind the pool while the AI pipeline — the part
    // the candidate actually waits on — was still idle.
    //
    // 20 gives that headroom without approaching a managed instance's
    // max_connections (Render's smallest Postgres allows 22–100 depending on plan,
    // and the connection string is frequently pointed at a pooled endpoint), so
    // POSTGRES_POOL_MAX exists for deployments with a different ceiling.
    max: env.POSTGRES_POOL_MAX,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  };

  const pool = new Pool(poolConfig);
  // Drizzle's query logger JSON-serialises every statement and its parameters and
  // writes it synchronously to stdout — per query, in production too, where nobody
  // reads it. It is a development aid, so it is enabled only outside production.
  const logQueries = env.NODE_ENV !== "production";
  const db = drizzle({ client: pool, logger: logQueries });
  if (!logQueries) {
    logger.debug({ max: poolConfig.max }, "PostgreSQL pool ready (query logging off)");
  }
  return { pool, db };
}

export function getPgDb(): PgDb {
  instance ??= createInstance();
  return instance.db;
}

export function getPgPool(): Pool {
  instance ??= createInstance();
  return instance.pool;
}

export async function testPgConnection(): Promise<boolean> {
  try {
    const result = await getPgDb().execute(sql`select 1`);
    if (result?.rows.length > 0) {
      logger.info({ key: "POSTGRES_URI" }, "PostgreSQL connection successful.");
      return true;
    }
    logger.error({ key: "POSTGRES_URI" }, "PostgreSQL connection check returned no rows.");
    return false;
  } catch (err) {
    logger.error({ key: "POSTGRES_URI", err }, "PostgreSQL connection failed.");
    return false;
  }
}

export default getPgDb;
