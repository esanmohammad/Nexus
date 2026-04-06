import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(8080),
  GCP_PROJECT_ID: z.string().min(1),
  GCP_REGION: z.string().default("us-central1"),
  GCS_BUCKET_SNAPSHOTS: z.string().min(1),
  ARTIFACT_REGISTRY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export const config: Config = ConfigSchema.parse(process.env);
