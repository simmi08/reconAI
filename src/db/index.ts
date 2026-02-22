import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getConfig } from "@/core/config";
import * as schema from "@/db/schema";

const config = getConfig();

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10
});

export const db = drizzle(pool, { schema });
export { pool };
