import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import type { TranscriptDto, TranscriptProvider } from "@callmind/shared";

const GROQ_TRANSCRIPTION_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_ERROR_MESSAGE_LENGTH = 500;

export interface GroqTranscriptionConfig {
  apiKey: string;
  model: string;
  maxBytes: number;
  recordingId: string;
  timeoutMs?: number;
}

export class TranscriptionError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code: string, retryable: boolean) {
    super(message);
    this.name = "TranscriptionError";
    this.code = code;
    this.retryable = retryable;
  }
}

interface GroqRawSegment {
  id?: unknown;
  start?: unknown;
  end?: unknown;
  text?: unknown;
}

interface GroqRawResponse {
  duration?: unknown;
  language?: unknown;
  text?: unknown;
  segments?: unknown;
}

function nonNegativeNumber(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function redact(value: string, apiKey: string): string {
  const withoutKey = apiKey
    ? value.split(apiKey).join("[redacted]")
    : value;
  return withoutKey.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

function statusCode(code: number): { code: string; retryable: boolean } {
  if (code === 401 || code === 403) {
    return { code: "TRANSCRIPTION_UNAUTHORIZED", retryable: false };
  }
  if (code === 413) {
    return {
      code: "TRANSCRIPTION_FILE_TOO_LARGE",
      retryable: false,
    };
  }
  if (code === 429) {
    return { code: "TRANSCRIPTION_RATE_LIMITED", retryable: true };
  }
  if (code >= 500) {
    return { code: "TRANSCRIPTION_PROVIDER_ERROR", retryable: true };
  }
  return { code: "TRANSCRIPTION_BAD_REQUEST", retryable: false };
}

async function readProviderError(
  response: Response,
  apiKey: string,
): Promise<string> {
  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    try {
      return redact(await response.text(), apiKey);
    } catch {
      return `Groq transcription failed with HTTP ${response.status}.`;
    }
  }

  const message =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
      ? body.error.message
      : `Groq transcription failed with HTTP ${response.status}.`;

  return redact(message, apiKey);
}

function buildMultipartBody(
  filePath: string,
  file: Buffer,
  model: string,
): { body: Buffer; contentType: string } {
  const boundary = `----callmind-${randomUUID()}`;
  const extension = extname(filePath).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const filename = `audio${extension}`;

  const parts = [
    Buffer.from(
      `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="model"\r\n\r\n' +
        `${model}\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="response_format"\r\n\r\n' +
        "verbose_json\r\n",
    ),
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        "Content-Type: application/octet-stream\r\n\r\n",
    ),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];

  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export function parseGroqTranscriptionResponse(
  payload: GroqRawResponse,
  model: string,
  recordingId: string,
): TranscriptDto {
  const text = typeof payload.text === "string" ? payload.text : "";
  const language =
    typeof payload.language === "string" && payload.language.trim().length > 0
      ? payload.language
      : "unknown";
  const rawDuration = nonNegativeNumber(payload.duration);
  const rawSegments = Array.isArray(payload.segments)
    ? (payload.segments as GroqRawSegment[])
    : [];

  const segments = rawSegments
    .map((segment, index) => {
      const start = nonNegativeNumber(segment.start) ?? 0;
      const end = Math.max(nonNegativeNumber(segment.end) ?? start, start);
      return {
        id: `seg-${recordingId}-${index}`,
        index:
          nonNegativeNumber(segment.id) !== null
            ? Math.trunc(nonNegativeNumber(segment.id) as number)
            : index,
        start,
        end,
        text: typeof segment.text === "string" ? segment.text.trim() : "",
        speakerId: null,
      };
    })
    .filter((segment) => segment.text.length > 0);

  const maxEnd = segments.reduce((max, segment) => Math.max(max, segment.end), 0);
  const durationSeconds = rawDuration ?? maxEnd;
  const normalizedSegments =
    segments.length > 0
      ? segments
      : text.trim().length > 0
        ? [
            {
              id: `seg-${recordingId}-0`,
              index: 0,
              start: 0,
              end: durationSeconds,
              text: text.trim(),
              speakerId: null,
            },
          ]
        : [];

  return {
    id: `tx-${recordingId}`,
    text,
    language,
    durationSeconds,
    provider: "groq" satisfies TranscriptProvider,
    model,
    processedAt: new Date().toISOString(),
    segments: normalizedSegments,
  };
}

export async function transcribeWithGroq(
  filePath: string,
  config: GroqTranscriptionConfig,
): Promise<TranscriptDto> {
  if (!config.apiKey) {
    throw new TranscriptionError(
      "Groq API key is not configured.",
      "TRANSCRIPTION_NOT_CONFIGURED",
      false,
    );
  }

  const fileStats = await stat(filePath);
  if (fileStats.size > config.maxBytes) {
    throw new TranscriptionError(
      "The audio file exceeds the configured transcription size limit.",
      "TRANSCRIPTION_FILE_TOO_LARGE",
      false,
    );
  }

  const file = await readFile(filePath);
  const multipart = buildMultipartBody(filePath, file, config.model);

  let response: Response;
  try {
    response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": multipart.contentType,
      },
      body: multipart.body,
      signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";
    throw new TranscriptionError(
      redact(detail, config.apiKey),
      "TRANSCRIPTION_REQUEST_FAILED",
      true,
    );
  }

  if (!response.ok) {
    const details = await readProviderError(response, config.apiKey);
    const mapped = statusCode(response.status);
    throw new TranscriptionError(details, mapped.code, mapped.retryable);
  }

  let payload: GroqRawResponse;
  try {
    payload = (await response.json()) as GroqRawResponse;
  } catch {
    throw new TranscriptionError(
      "Groq returned an invalid transcription response.",
      "TRANSCRIPTION_INVALID_RESPONSE",
      true,
    );
  }

  return parseGroqTranscriptionResponse(payload, config.model, config.recordingId);
}
