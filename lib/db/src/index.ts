import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

<<<<<<< HEAD
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to connect to the database");
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("supabase") || connectionString.includes("render")
    ? { rejectUnauthorized: false }
    : undefined,
=======
export const pool = new Pool({
  user: "mi_lectura_user",
  host: "dpg-d85p7h3eo5us73bi9uv0-a.oregon-postgres.render.com",
  database: "mi_lectura",
  password: "ARnwG3dzFmAcEczb89hNzRKQFxpjhRrm",
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
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
