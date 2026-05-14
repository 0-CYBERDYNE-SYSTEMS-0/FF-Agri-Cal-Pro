import { drizzle } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not set — using in-memory storage (MemStorage)");
}

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    const sql = neon(process.env.DATABASE_URL);
    _db = drizzle(sql, { schema });
    console.log("Database connected (Neon serverless)");
  }
  if (!_db) {
    throw new Error("DATABASE_URL not configured. Set DATABASE_URL environment variable.");
  }
  return _db;
}

export function hasDb(): boolean {
  return !!process.env.DATABASE_URL;
}
