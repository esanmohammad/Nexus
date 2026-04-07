import { createDb } from "../../../../packages/db/src/index.js";

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _db = createDb(url);
  }
  return _db;
}

export function useDb(): boolean {
  // In test environments, default to in-memory unless USE_REAL_DB is explicitly set
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return !!process.env.USE_REAL_DB;
  }
  return !!process.env.DATABASE_URL;
}
