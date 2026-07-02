import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to connect to the database");
}

function requiresSsl(url: string): boolean {
  if (url.includes("supabase") || url.includes("render.com")) return true;
  if (/sslmode=(require|verify-full|verify-ca)/i.test(url)) return true;
  return process.env.PGSSLMODE === "require";
}

export const pool = new Pool({
  connectionString,
  ssl: requiresSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
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
