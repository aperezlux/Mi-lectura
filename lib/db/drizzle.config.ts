import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import path from "path";

config({
  path: path.resolve(__dirname, "../../.env"),
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const connectionString = process.env.DATABASE_URL;

const useSsl =
  connectionString.includes("supabase") ||
  connectionString.includes("render");

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