# ReconAI

ReconAI is a full-stack prototype for procurement reconciliation from a chaotic raw data lake.

## Stack

- Next.js App Router + TypeScript
- PostgreSQL + Drizzle ORM + drizzle-kit
- Gemini (`gemini-3-flash-preview`) via Google GenAI SDK (server-side only)
- TailwindCSS


## Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Update `.env` values (`DATABASE_URL`, `GEMINI_API_KEY`, etc.).

4. Run migrations:

```bash
npm run db:migrate
```

5. Start dev server:

```bash
npm run dev
```

Open: `http://localhost:3000/dashboard`

## Raw Data + Storage

- Raw input directory: `./data_lake/raw`
- Runtime output directory: `./storage`
  - `storage/transactions/<transactionKey>/docs/...`
  - `storage/transactions/<transactionKey>/extracted/<documentId>.json`
  - `storage/transactions/<transactionKey>/transaction.json`

## Ingestion Flow

- `POST /api/ingest/scan` scans raw files, computes sha256, and dedupes by hash.
- `POST /api/ingest/process?limit=25` processes backlog synchronously.

CLI equivalents:

```bash
npm run ingest:scan
npm run ingest:process
```

## API Endpoints

- `POST /api/ingest/scan`
- `POST /api/ingest/process?limit=25&retryFailed=1`
- `GET /api/documents`
- `GET /api/transactions`
- `GET /api/transactions/[id]`
- `POST /api/transactions/[id]` (actions: rerun extraction, resolve review)
- `GET /api/reports`
- `GET /api/health`

## Tests

```bash
npm test
```

Includes tests for:
- transaction state machine
- amount tolerance matching
- duplicate invoice detection

## Notes

- If `GEMINI_API_KEY` is missing, extraction falls back to a deterministic heuristic parser for local demo continuity.
