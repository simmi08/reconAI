import { defineConfig } from "drizzle-kit";

const migrateUrl = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL;
if (!migrateUrl) {
  throw new Error("DATABASE_URL_MIGRATE or DATABASE_URL is required to run drizzle-kit commands");
}

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: migrateUrl
  },
  verbose: true,
  strict: true
});
