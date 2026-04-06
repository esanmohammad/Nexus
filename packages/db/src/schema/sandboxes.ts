import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const sandboxStateEnum = pgEnum("sandbox_state", [
  "creating",
  "running",
  "sleeping",
  "destroying",
  "destroyed",
]);

export const accessModeEnum = pgEnum("access_mode", [
  "owner_only",
  "team",
  "anyone",
  "custom",
]);

export const runtimeEnum = pgEnum("runtime", [
  "nodejs",
  "python",
  "static",
  "go",
  "dockerfile",
]);

export const sandboxes = pgTable("sandboxes", {
  "id": uuid("id").primaryKey().defaultRandom(),
  "name": text("name").unique().notNull(),
  "owner_email": text("owner_email").notNull(),
  "team": text("team"),
  "runtime": runtimeEnum("runtime"),
  "state": sandboxStateEnum("state").notNull().default("creating"),
  "access_mode": accessModeEnum("access_mode").notNull().default("owner_only"),
  "allowed_emails": jsonb("allowed_emails").$type<string[]>(),
  "cloud_run_service": text("cloud_run_service"),
  "cloud_run_url": text("cloud_run_url"),
  "region": text("region").notNull().default("us-central1"),
  "database_enabled": boolean("database_enabled").notNull().default(false),
  "neon_project_id": text("neon_project_id"),
  "neon_branch_id": text("neon_branch_id"),
  "database_url": text("database_url"),
  "ttl_days": integer("ttl_days").notNull().default(7),
  "expires_at": timestamp("expires_at", { withTimezone: true }),
  "expiry_notified_72h": boolean("expiry_notified_72h").notNull().default(false),
  "expiry_notified_24h": boolean("expiry_notified_24h").notNull().default(false),
  "github_repo": text("github_repo"),
  "github_webhook_id": text("github_webhook_id"),
  "current_version": integer("current_version"),
  "metadata": jsonb("metadata").$type<Record<string, string>>(),
  "created_at": timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  "updated_at": timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  "destroyed_at": timestamp("destroyed_at", { withTimezone: true }),
});
