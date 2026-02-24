import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_MIGRATE: z.string().optional(),
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_RAW_BUCKET: z.string().default("raw"),
  SUPABASE_STORAGE_BUCKET: z.string().default("storage"),
  SUPABASE_RAW_PREFIX: z.string().default(""),
  SUPABASE_STORAGE_PREFIX: z.string().default(""),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3-flash-preview"),
  PROCESS_BATCH_SIZE: z.coerce.number().int().positive().default(25),
  CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.75),
  AMOUNT_TOLERANCE_PCT: z.coerce.number().min(0).max(1).default(0.02)
});

export type AppConfig = {
  databaseUrl: string;
  databaseUrlMigrate?: string;
  supabase: {
    url: string;
    serviceRoleKey: string;
    rawBucket: string;
    storageBucket: string;
    rawPrefix: string;
    storagePrefix: string;
  };
  geminiApiKey?: string;
  geminiModel: string;
  processBatchSize: number;
  confidenceThreshold: number;
  amountTolerancePct: number;
};

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = envSchema.parse(process.env);
  const serviceRoleKey = parsed.SUPABASE_SECRET_KEY ?? parsed.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SECRET_KEY (recommended) or SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  cachedConfig = {
    databaseUrl: parsed.DATABASE_URL,
    databaseUrlMigrate: parsed.DATABASE_URL_MIGRATE,
    supabase: {
      url: parsed.SUPABASE_URL.trim().replace(/\/+$/g, ""),
      serviceRoleKey,
      rawBucket: parsed.SUPABASE_RAW_BUCKET,
      storageBucket: parsed.SUPABASE_STORAGE_BUCKET,
      rawPrefix: parsed.SUPABASE_RAW_PREFIX.trim().replace(/^\/+|\/+$/g, ""),
      storagePrefix: parsed.SUPABASE_STORAGE_PREFIX.trim().replace(/^\/+|\/+$/g, "")
    },
    geminiApiKey: parsed.GEMINI_API_KEY,
    geminiModel: parsed.GEMINI_MODEL,
    processBatchSize: parsed.PROCESS_BATCH_SIZE,
    confidenceThreshold: parsed.CONFIDENCE_THRESHOLD,
    amountTolerancePct: parsed.AMOUNT_TOLERANCE_PCT
  };

  return cachedConfig;
}
