import { resolve } from "node:path";
import {
  DEFAULT_GEMINI_FALLBACK_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_STT_MAX_BYTES,
  DEFAULT_GROQ_STT_MODEL,
  DEFAULT_MAX_FILES_PER_UPLOAD,
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_WORKSPACE_ID,
} from "@callmind/shared";
import { config } from "dotenv";
import { z } from "zod";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

export const DEFAULT_STORAGE_DIR = resolve(__dirname, "../../../../storage");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(8080),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  CORS_ORIGIN: z.string().default("http://localhost:5174"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  STORAGE_DIR: z.string().min(1).default(DEFAULT_STORAGE_DIR),
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_MAX_UPLOAD_BYTES),
  MAX_FILES_PER_UPLOAD: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(DEFAULT_MAX_FILES_PER_UPLOAD),
  WORKSPACE_ID: z.string().min(1).default(DEFAULT_WORKSPACE_ID),
  GEMINI_API_KEY: z.string().default(""),
  GEMINI_MODEL: z.string().min(1).default(DEFAULT_GEMINI_MODEL),
  GEMINI_FALLBACK_MODEL: z
    .string()
    .min(1)
    .default(DEFAULT_GEMINI_FALLBACK_MODEL),
  GROQ_API_KEY: z.string().default(""),
  GROQ_STT_MODEL: z.string().min(1).default(DEFAULT_GROQ_STT_MODEL),
  GROQ_STT_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_GROQ_STT_MAX_BYTES),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration -> ${details}`);
  }

  return parsed.data;
}
