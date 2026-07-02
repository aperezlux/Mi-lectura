<<<<<<< HEAD
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import path from "path";

config({
  path: path.resolve(__dirname, "../../.env"),
});
=======
import { defineConfig } from "drizzle-kit";
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

<<<<<<< HEAD
const connectionString = process.env.DATABASE_URL;

const useSsl =
  connectionString.includes("supabase") ||
  connectionString.includes("render");

=======
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
<<<<<<< HEAD
    url: connectionString,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
=======
    url: process.env.DATABASE_URL,
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
  },
  introspect: {
    casing: "camelCase",
  },
<<<<<<< HEAD
});
=======
});
>>>>>>> 88b3f8bfe705968b92536ba2edc20cd99dffdb82
