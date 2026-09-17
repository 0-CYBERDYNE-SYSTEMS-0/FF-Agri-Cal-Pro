import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  // The `session` table is created and owned at runtime by connect-pg-simple
  // (see server/index.ts) and is intentionally not part of shared/schema.ts.
  // Excluding it prevents drizzle-kit push from treating it as drift and
  // dropping live sessions.
  tablesFilter: ["!session"],
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
