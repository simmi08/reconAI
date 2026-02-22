import { GoogleGenAI } from "@google/genai";

import { getConfig } from "@/core/config";

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getConfig();
  if (!config.geminiApiKey) {
    return null;
  }

  cachedClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
  return cachedClient;
}
