import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const auditLogs = pgTable("audit_logs", {
  "id": uuid("id").primaryKey().defaultRandom(),
  "actor_email": text("actor_email").notNull(),
  "action": text("action").notNull(),
  "resource_type": text("resource_type").notNull(),
  "resource_id": text("resource_id").notNull(),
  "details": jsonb("details").$type<Record<string, unknown>>(),
  "ip_address": text("ip_address"),
  "user_agent": text("user_agent"),
  "created_at": timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
