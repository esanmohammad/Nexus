import { z } from "zod";
import { AccessMode, Runtime } from "../types/enums.js";

const nameRegex = /^[a-z][a-z0-9-]*[a-z0-9]$/;

export const CreateSandboxSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(63)
    .regex(nameRegex, "Name must be lowercase alphanumeric with hyphens, starting with a letter and ending with a letter or number"),
  runtime: z.nativeEnum(Runtime).optional(),
  database: z.boolean().default(false),
  ttl_days: z.number().int().min(1).max(90).default(7),
  access_mode: z.nativeEnum(AccessMode).default("owner_only"),
  allowed_emails: z.array(z.string().email()).optional(),
  team: z.string().optional(),
  label: z.string().max(200).optional(),
  metadata: z.record(z.string()).optional(),
  github_url: z.string().url().optional(),
});

export type CreateSandboxInput = z.infer<typeof CreateSandboxSchema>;

export const UpdateSandboxSchema = z.object({
  label: z.string().max(200).optional(),
  team: z.string().optional(),
  access_mode: z.nativeEnum(AccessMode).optional(),
  allowed_emails: z.array(z.string().email()).optional(),
  metadata: z.record(z.string()).optional(),
});

export type UpdateSandboxInput = z.infer<typeof UpdateSandboxSchema>;

export const ExtendSandboxSchema = z.object({
  ttl_days: z.number().int().min(1).max(90),
});

export type ExtendSandboxInput = z.infer<typeof ExtendSandboxSchema>;

export const ShareSandboxSchema = z.object({
  access_mode: z.nativeEnum(AccessMode),
  allowed_emails: z.array(z.string().email()).optional(),
});

export type ShareSandboxInput = z.infer<typeof ShareSandboxSchema>;
