import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export const pool = new Pool({
  user: "mi_lectura_user",
  host: "dpg-d85p7h3eo5us73bi9uv0-a.oregon-postgres.render.com",
  database: "mi_lectura",
  password: "ARnwG3dzFmAcEczb89hNzRKQFxpjhRrm",
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
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
