import { getConfig } from "@/core/config";
import { processPendingDocuments, scanAndRegisterDocuments } from "@/core/ingest/pipeline";

async function main() {
  const command = process.argv[2];
  const config = getConfig();

  if (command === "scan") {
    const result = await scanAndRegisterDocuments();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "process") {
    const limitArg = Number(process.argv[3] ?? config.processBatchSize);
    const includeFailed = process.argv.includes("--retry-failed");

    const result = await processPendingDocuments({
      limit: Number.isFinite(limitArg) ? limitArg : config.processBatchSize,
      retryFailed: includeFailed
    });

    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error("Usage: tsx src/cli/ingest.ts [scan|process] [limit] [--retry-failed]");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
