import { z } from "zod";

export const DeployVersionSchema = z.object({
  label: z.string().max(200).optional(),
  migration_sql: z.string().optional(),
  github_url: z.string().url().optional(),
});

export type DeployVersionInput = z.infer<typeof DeployVersionSchema>;

export const RollbackSchema = z.object({
  target_version: z.number().int().positive().optional(),
});

export type RollbackInput = z.infer<typeof RollbackSchema>;
