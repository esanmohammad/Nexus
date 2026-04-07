import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as sandboxSchema from "./schema/sandboxes.js";
import * as versionSchema from "./schema/versions.js";
import * as auditLogSchema from "./schema/audit-logs.js";

export const schema = {
  ...sandboxSchema,
  ...versionSchema,
  ...auditLogSchema,
};

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;

export { sandboxSchema, versionSchema, auditLogSchema };

// Re-export drizzle-orm operators so consumers don't need a direct dependency
export { eq, ne, and, or, desc, asc, gt, gte, lt, lte, isNull, isNotNull } from "drizzle-orm";
