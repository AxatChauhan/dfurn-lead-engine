import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.mwvbjdifhphfpvrnqqhs:superSecretSupabasePassword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

// Global singleton connection pool to prevent connection exhaustion in serverless
declare global {
  var _leadEnginePgPool: Pool | undefined;
}

export const pool =
  global._leadEnginePgPool ||
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  });

if (process.env.NODE_ENV !== "production") {
  global._leadEnginePgPool = pool;
}

export const db = drizzle(pool, { schema });
