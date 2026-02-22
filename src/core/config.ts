import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  RAW_DATA_DIR: z.string().default("./data_lake/raw"),
  STORAGE_DIR: z.string().default("./storage"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3-flash-preview"),
  PROCESS_BATCH_SIZE: z.coerce.number().int().positive().default(25),
  CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.75),
  AMOUNT_TOLERANCE_PCT: z.coerce.number().min(0).max(1).default(0.02)
});

export type AppConfig = {
  databaseUrl: string;
  rawDataDir: string;
  storageDir: string;
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

  cachedConfig = {
    databaseUrl: parsed.DATABASE_URL,
    rawDataDir: path.resolve(process.cwd(), parsed.RAW_DATA_DIR),
    storageDir: path.resolve(process.cwd(), parsed.STORAGE_DIR),
    geminiApiKey: parsed.GEMINI_API_KEY,
    geminiModel: parsed.GEMINI_MODEL,
    processBatchSize: parsed.PROCESS_BATCH_SIZE,
    confidenceThreshold: parsed.CONFIDENCE_THRESHOLD,
    amountTolerancePct: parsed.AMOUNT_TOLERANCE_PCT
  };

  return cachedConfig;
}
