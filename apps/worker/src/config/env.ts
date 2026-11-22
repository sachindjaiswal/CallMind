import { resolve } from "node:path";
import {
  DEFAULT_GEMINI_FALLBACK_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_STT_MAX_BYTES,
  DEFAULT_GEMINI_STT_MODEL,
  DEFAULT_GROQ_STT_MAX_BYTES,
  DEFAULT_GROQ_STT_MODEL,
  DEFAULT_STT_STRATEGY,
  STT_STRATEGIES,
} from "@callmind/shared";
import { config } from "dotenv";
import { z } from "zod";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

export const DEFAULT_WORKER_STORAGE_DIR = resolve(
  __dirname,
  "../../../../storage",
);

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  STORAGE_DIR: z.string().min(1).default(DEFAULT_WORKER_STORAGE_DIR),
  FFPROBE_PATH: z.string().min(1).default("ffprobe"),
  FFMPEG_PATH: z.string().min(1).default("ffmpeg"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
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
  GEMINI_STT_MODEL: z.string().min(1).default(DEFAULT_GEMINI_STT_MODEL),
  GEMINI_STT_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_GEMINI_STT_MAX_BYTES),
  STT_STRATEGY: z.enum(STT_STRATEGIES).default(DEFAULT_STT_STRATEGY),
});

export type WorkerEnv = z.infer<typeof envSchema>;

export function loadWorkerEnv(
  source: NodeJS.ProcessEnv = process.env,
): WorkerEnv {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid worker environment -> ${details}`);
  }

  return parsed.data;
}
