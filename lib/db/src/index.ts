import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to connect to the database");
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("supabase") || connectionString.includes("render")
    ? { rejectUnauthorized: false }
    : undefined,
});

pool.connect()
  .then(() => {
    console.log("✅ PostgreSQL conectado");
  })
  .catch((err) => {
    console.error("❌ Error PostgreSQL:", err);
  });

export const db = drizzle(pool, { schema });

export * from "./schema";
