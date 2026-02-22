import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run drizzle-kit commands");
}

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL
  },
  verbose: true,
  strict: true
});
