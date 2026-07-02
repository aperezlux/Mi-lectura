import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(configDir, "../../.env");

if (existsSync(envPath)) {
  config({ path: envPath });
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const connectionString = process.env.DATABASE_URL;

const useSsl =
  connectionString.includes("supabase") ||
  connectionString.includes("render.com") ||
  /sslmode=(require|verify-full|verify-ca)/i.test(connectionString);

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  },
  introspect: {
    casing: "camelCase",
  },
});
