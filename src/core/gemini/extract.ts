import { z } from "zod";

import { getConfig } from "@/core/config";
import { getGeminiClient } from "@/core/gemini/client";
import type { ExtractedDocument } from "@/types/domain";

const lineItemSchema = z.object({
  description: z.string().default(""),
  quantity: z.number().nullable().default(null),
  unitPrice: z.number().nullable().default(null),
  lineTotal: z.number().nullable().default(null)
});

const extractionSchema = z.object({
  docType: z.enum(["PURCHASE_ORDER", "INVOICE", "GOODS_RECEIPT", "OTHER"]),
  poNumber: z.string().default(""),
  invoiceNumber: z.string().default(""),
  grnNumber: z.string().default(""),
  vendorName: z.string().default(""),
  vendorId: z.string().default(""),
  country: z.string().default(""),
  currency: z.string().default(""),
  docDate: z.string().default(""),
  dueDate: z.string().default(""),
  totalAmount: z.number().nullable().default(null),
  taxAmount: z.number().nullable().default(null),
  lineItems: z.array(lineItemSchema).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  notes: z.string().default("")
});

type ExtractInput = {
  rawText: string;
  fileName: string;
  poContextJson?: unknown;
};

function parsePossibleNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const cleaned = value.replace(/[, ]/g, "").replace(/[A-Za-z$€£₹]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value: string): string {
  const raw = value.trim();
  if (!raw) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const slashDate = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashDate) {
    const [, dayRaw, monthRaw, yearRaw] = slashDate;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const day = dayRaw.padStart(2, "0");
    const month = monthRaw.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const day = String(parsed.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return "";
}

function cleanModelJsonText(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
    return trimmed.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  return trimmed;
}

function inferDocType(rawText: string): ExtractedDocument["docType"] {
  const text = rawText.toLowerCase();
  if (text.includes("goods receipt") || text.includes("grn")) {
    return "GOODS_RECEIPT";
  }
  if (text.includes("invoice") || text.includes("rechnung")) {
    return "INVOICE";
  }
  if (text.includes("purchase order") || text.includes("po number") || text.includes("po#")) {
    return "PURCHASE_ORDER";
  }
  return "OTHER";
}

function heuristicExtract(rawText: string): ExtractedDocument {
  const poMatch = rawText.match(/\bPO\s*(?:Number|No\.?|#|Ref(?:erence)?)?\s*[:#-]?\s*([A-Z0-9-]{3,})/i);
  const invoiceMatch = rawText.match(/\b(?:Invoice\s*(?:Number|No\.?|#)|Inv\s*No\.?|Invoice)\s*[:#-]?\s*([A-Z0-9-]{3,})/i);
  const grnMatch = rawText.match(/\bGRN\s*(?:Number|No\.?|#)?\s*[:#-]?\s*([A-Z0-9-]{3,})/i);
  const vendorMatch = rawText.match(/\b(?:Vendor|Supplier)\s*(?:Name|Id|ID|code|Code)?\s*[:=-]\s*([^\n]+)/i);
  const countryMatch = rawText.match(/\bCountry\s*[:=-]\s*([A-Za-z]{2,3})\b/i);
  const currencyMatch = rawText.match(/\bCurrency\s*[:=-]\s*([A-Za-z]{3})\b/i);
  const totalMatch = rawText.match(/\b(?:Grand\s*Total|Invoice\s*Total|TOTAL\s*DUE|Total\s*Amount|TOTAL)\s*[:=-]?\s*(?:[A-Za-z]{3}\s*)?([0-9,]+(?:\.\d{1,2})?)/i);
  const taxMatch = rawText.match(/\b(?:Tax|GST|VAT|MwSt)\s*(?:\d+(?:\.\d+)?%?)?\s*[:=-]?\s*(?:[A-Za-z]{3}\s*)?([0-9,]+(?:\.\d{1,2})?)/i);
  const docDateMatch = rawText.match(/\b(?:Date|Invoice Date|PO Date|GRN Date|Doc dt)\s*[:=-]\s*([^\n]+)/i);
  const dueDateMatch = rawText.match(/\b(?:Due Date|Payment Due Date)\s*[:=-]\s*([^\n]+)/i);

  return {
    docType: inferDocType(rawText),
    poNumber: poMatch?.[1]?.trim() ?? "",
    invoiceNumber: invoiceMatch?.[1]?.trim() ?? "",
    grnNumber: grnMatch?.[1]?.trim() ?? "",
    vendorName: vendorMatch?.[1]?.trim() ?? "",
    vendorId: "",
    country: (countryMatch?.[1] ?? "").toUpperCase(),
    currency: (currencyMatch?.[1] ?? "").toUpperCase(),
    docDate: normalizeDate(docDateMatch?.[1] ?? ""),
    dueDate: normalizeDate(dueDateMatch?.[1] ?? ""),
    totalAmount: parsePossibleNumber(totalMatch?.[1]),
    taxAmount: parsePossibleNumber(taxMatch?.[1]),
    lineItems: [],
    confidence: 0.4,
    notes: "Heuristic extraction fallback used because GEMINI_API_KEY was unavailable."
  };
}

function normalizeExtractedDoc(parsed: z.infer<typeof extractionSchema>): ExtractedDocument {
  return {
    docType: parsed.docType,
    poNumber: parsed.poNumber.trim(),
    invoiceNumber: parsed.invoiceNumber.trim(),
    grnNumber: parsed.grnNumber.trim(),
    vendorName: parsed.vendorName.trim(),
    vendorId: parsed.vendorId.trim(),
    country: parsed.country.trim().toUpperCase(),
    currency: parsed.currency.trim().toUpperCase(),
    docDate: normalizeDate(parsed.docDate),
    dueDate: normalizeDate(parsed.dueDate),
    totalAmount: parsed.totalAmount,
    taxAmount: parsed.taxAmount,
    lineItems: parsed.lineItems.map((item) => ({
      description: item.description.trim(),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal
    })),
    confidence: Math.max(0, Math.min(1, parsed.confidence)),
    notes: parsed.notes.trim()
  };
}

async function callGeminiForJson(prompt: string): Promise<string> {
  const config = getConfig();
  const client = getGeminiClient();

  if (!client) {
    throw new Error("Gemini client unavailable");
  }

  const response = await client.models.generateContent({
    model: config.geminiModel,
    contents: prompt,
    config: {
      temperature: 0,
      responseMimeType: "application/json"
    }
  });

  const textCandidate = response.text;
  if (typeof textCandidate === "string" && textCandidate.trim().length > 0) {
    return textCandidate;
  }

  throw new Error("Gemini returned an empty response");
}

function buildExtractionPrompt(input: ExtractInput): string {
  const poContext = input.poContextJson ? `\nPO context JSON:\n${JSON.stringify(input.poContextJson)}` : "";

  return [
    "You are an AP procurement document extraction engine.",
    "Extract structured fields from the following raw document text.",
    "Return JSON only (no markdown, no prose), with this shape:",
    "{",
    '  "docType": "PURCHASE_ORDER"|"INVOICE"|"GOODS_RECEIPT"|"OTHER",',
    '  "poNumber": "",',
    '  "invoiceNumber": "",',
    '  "grnNumber": "",',
    '  "vendorName": "",',
    '  "vendorId": "",',
    '  "country": "",',
    '  "currency": "",',
    '  "docDate": "YYYY-MM-DD or empty",',
    '  "dueDate": "YYYY-MM-DD or empty",',
    '  "totalAmount": number|null,',
    '  "taxAmount": number|null,',
    '  "lineItems": [{"description": "", "quantity": number|null, "unitPrice": number|null, "lineTotal": number|null}],',
    '  "confidence": 0..1,',
    '  "notes": "short note"',
    "}",
    "Rules:",
    "- If missing, use empty string for text fields and null for numeric fields.",
    "- Normalize dates to YYYY-MM-DD if possible.",
    "- Keep confidence low for ambiguous or OCR-noisy text.",
    `File name: ${input.fileName}`,
    poContext,
    "Document text:",
    input.rawText
  ]
    .filter(Boolean)
    .join("\n");
}

function buildRepairPrompt(badPayload: string): string {
  return [
    "Fix this JSON so it is strictly valid and follows the required extraction schema.",
    "Return only corrected JSON, no markdown.",
    badPayload
  ].join("\n\n");
}

export async function extractWithGemini(input: ExtractInput): Promise<ExtractedDocument> {
  const client = getGeminiClient();
  if (!client) {
    return heuristicExtract(input.rawText);
  }

  const prompt = buildExtractionPrompt(input);

  let parsed: unknown;
  let firstResponse = "";
  try {
    firstResponse = await callGeminiForJson(prompt);
    parsed = JSON.parse(cleanModelJsonText(firstResponse));
  } catch {
    const repairResponse = await callGeminiForJson(buildRepairPrompt(firstResponse || prompt));
    parsed = JSON.parse(cleanModelJsonText(repairResponse));
  }

  try {
    return normalizeExtractedDoc(extractionSchema.parse(parsed));
  } catch {
    const repaired = await callGeminiForJson(buildRepairPrompt(JSON.stringify(parsed)));
    const repairedParsed = JSON.parse(cleanModelJsonText(repaired));
    return normalizeExtractedDoc(extractionSchema.parse(repairedParsed));
  }
}
