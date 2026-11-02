import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { initializeDatabase } from "./init";
import { seedDemoData } from "./seed";

// Automatically run initialization & table setup
const sqlite = initializeDatabase();

export const db = drizzle(sqlite, { schema });
export { sqlite };

// Auto-seed baseline demonstration prospects if table is empty
try {
  seedDemoData(db);
} catch (err) {
  console.log("[DB Seed] Note:", err);
}
