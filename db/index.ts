import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema";

const { Pool } = pg;

let _pool: pg.Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

export function hasDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getPool(): pg.Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured. Set DATABASE_URL to a standard PostgreSQL URL.");
    }
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
  }
  return _pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

export async function checkDatabaseConnection(): Promise<void> {
  await getPool().query("SELECT 1");
}
