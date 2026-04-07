import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sandboxes } from "./sandboxes";

export const versionStatusEnum = pgEnum("version_status", [
  "building",
  "live",
  "rolled_back",
  "failed",
]);

export const versions = pgTable("versions", {
  "id": uuid("id").primaryKey().defaultRandom(),
  "sandbox_id": uuid("sandbox_id")
    .notNull()
    .references(() => sandboxes.id, { onDelete: "cascade" }),
  "number": integer("number").notNull(),
  "label": text("label"),
  "status": versionStatusEnum("status").notNull().default("building"),
  "source_snapshot_url": text("source_snapshot_url"),
  "container_image": text("container_image"),
  "cloud_run_revision": text("cloud_run_revision"),
  "build_log_url": text("build_log_url"),
  "migration_sql": text("migration_sql"),
  "neon_branch_id": text("neon_branch_id"),
  "created_by": text("created_by"),
  "created_at": timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  "deployed_at": timestamp("deployed_at", { withTimezone: true }),
  "build_duration_ms": integer("build_duration_ms"),
});
