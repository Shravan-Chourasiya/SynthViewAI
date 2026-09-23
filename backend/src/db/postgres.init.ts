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
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  };

  const pool = new Pool(poolConfig);
  const db = drizzle({ client: pool, logger: true });
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
