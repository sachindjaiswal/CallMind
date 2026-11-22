import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import type {
  SttLanguageHint,
  TranscriptDto,
  TranscriptProvider,
} from "@callmind/shared";
import { TranscriptionError } from "./groqTranscription";

const GEMINI_TRANSCRIPTION_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_ERROR_MESSAGE_LENGTH = 500;
const execFileAsync = promisify(execFile);

const GEMINI_MIME_BY_EXTENSION: Record<string, string> = {
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".flac": "audio/flac",
};

export interface GeminiTranscriptionConfig {
  apiKey: string;
  model: string;
  maxBytes: number;
  recordingId: string;
  languageHint?: SttLanguageHint;
  ffmpegPath?: string;
  timeoutMs?: number;
}

interface GeminiWord {
  startOffset?: unknown;
  endOffset?: unknown;
}

interface GeminiAudioTranscription {
  text?: unknown;
  speakerLabel?: unknown;
  words?: unknown;
}

interface GeminiPart {
  text?: unknown;
  audioTranscription?: GeminiAudioTranscription;
}

interface GeminiRawResponse {
  candidates?: unknown;
}

interface GeminiSegment {
  id: string;
  index: number;
  start: number;
  end: number;
  text: string;
  speakerId: string | null;
}

function redact(value: string, apiKey: string): string {
  const withoutKey = apiKey ? value.split(apiKey).join("[redacted]") : value;
  return withoutKey.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

function statusCode(code: number): { code: string; retryable: boolean } {
  if (code === 401 || code === 403) {
    return { code: "TRANSCRIPTION_UNAUTHORIZED", retryable: false };
  }
  if (code === 413) {
    return { code: "TRANSCRIPTION_FILE_TOO_LARGE", retryable: false };
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
  try {
    const payload = (await response.json()) as {
      error?: { message?: unknown };
    };
    const message = payload.error?.message;
    if (typeof message === "string" && message.length > 0) {
      return redact(message, apiKey);
    }
  } catch {
    try {
      return redact(await response.text(), apiKey);
    } catch {
      return `Gemini transcription failed with HTTP ${response.status}.`;
    }
  }

  return `Gemini transcription failed with HTTP ${response.status}.`;
}

function offsetToSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const parsed = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  if (!parsed) {
    return null;
  }
  const seconds = Number(parsed[1]);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function partText(part: GeminiPart): string {
  const direct = typeof part.text === "string" ? part.text : "";
  const nested =
    typeof part.audioTranscription?.text === "string"
      ? part.audioTranscription.text
      : "";
  return (direct || nested).trim();
}

function detectLanguage(text: string, hint?: SttLanguageHint): string {
  if (hint && hint !== "auto") {
    return hint;
  }
  if (/[\u0900-\u097F]/.test(text)) {
    return "hi";
  }
  if (/[A-Za-z]/.test(text)) {
    return "en";
  }
  return "unknown";
}

function extractParts(payload: GeminiRawResponse): GeminiPart[] {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const content = candidates[0] as
    | { content?: { parts?: unknown } }
    | undefined;
  const parts = content?.content?.parts;
  return Array.isArray(parts) ? (parts as GeminiPart[]) : [];
}

export function parseGeminiTranscriptionResponse(
  payload: GeminiRawResponse,
  config: {
    model: string;
    recordingId: string;
    languageHint?: SttLanguageHint;
  },
): TranscriptDto {
  const parts = extractParts(payload);
  const segments: GeminiSegment[] = [];
  let previousEnd = 0;

  for (const part of parts) {
    const text = partText(part);
    if (!text) {
      continue;
    }

    const words = Array.isArray(part.audioTranscription?.words)
      ? (part.audioTranscription.words as GeminiWord[])
      : [];
    const starts = words
      .map((word) => offsetToSeconds(word.startOffset))
      .filter((value): value is number => value !== null);
    const ends = words
      .map((word) => offsetToSeconds(word.endOffset))
      .filter((value): value is number => value !== null);
    const start = starts.length > 0 ? Math.min(...starts) : previousEnd;
    const end = Math.max(ends.length > 0 ? Math.max(...ends) : start, start);
    const speakerLabel = part.audioTranscription?.speakerLabel;

    segments.push({
      id: `seg-${config.recordingId}-${segments.length}`,
      index: segments.length,
      start,
      end,
      text,
      speakerId:
        typeof speakerLabel === "string" && speakerLabel.trim().length > 0
          ? speakerLabel.trim()
          : null,
    });
    previousEnd = end;
  }

  const text = segments.map((segment) => segment.text).join(" ").trim();
  const durationSeconds = segments.reduce(
    (max, segment) => Math.max(max, segment.end),
    0,
  );

  return {
    id: `tx-${config.recordingId}`,
    text,
    language: detectLanguage(text, config.languageHint),
    durationSeconds,
    provider: "gemini" satisfies TranscriptProvider,
    model: config.model,
    processedAt: new Date().toISOString(),
    segments,
  };
}

function sourceMimeType(filePath: string): {
  mimeType: string;
  needsTranscode: boolean;
} {
  const mimeType = GEMINI_MIME_BY_EXTENSION[extname(filePath).toLowerCase()];
  return mimeType
    ? { mimeType, needsTranscode: false }
    : { mimeType: "audio/wav", needsTranscode: true };
}

async function convertToWav(
  filePath: string,
  ffmpegPath: string,
  timeoutMs: number,
): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  const tempDirectory = await mkdtemp(join(tmpdir(), "callmind-gemini-stt-"));
  const outputPath = join(tempDirectory, "audio.wav");

  try {
    await execFileAsync(
      ffmpegPath,
      ["-y", "-i", filePath, "-vn", "-ac", "1", "-ar", "16000", outputPath],
      { timeout: timeoutMs },
    );
  } catch (error) {
    await rm(tempDirectory, { recursive: true, force: true });
    const detail = error instanceof Error ? error.message : "Unknown error.";
    throw new TranscriptionError(
      `Could not prepare the audio for transcription: ${detail}`,
      "TRANSCRIPTION_CONVERSION_FAILED",
      false,
    );
  }

  return {
    filePath: outputPath,
    cleanup: async () => {
      await rm(tempDirectory, { recursive: true, force: true });
    },
  };
}

export async function transcribeWithGemini(
  filePath: string,
  config: GeminiTranscriptionConfig,
): Promise<TranscriptDto> {
  if (!config.apiKey) {
    throw new TranscriptionError(
      "Gemini API key is not configured.",
      "TRANSCRIPTION_NOT_CONFIGURED",
      false,
    );
  }

  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const originalStats = await stat(filePath);
  if (originalStats.size > config.maxBytes) {
    throw new TranscriptionError(
      "The audio file exceeds the configured transcription size limit.",
      "TRANSCRIPTION_FILE_TOO_LARGE",
      false,
    );
  }

  const source = sourceMimeType(filePath);
  let converted: { filePath: string; cleanup: () => Promise<void> } | null = null;

  try {
    if (source.needsTranscode) {
      converted = await convertToWav(
        filePath,
        config.ffmpegPath ?? "ffmpeg",
        timeoutMs,
      );
    }

    const sourcePath = converted?.filePath ?? filePath;
    const sourceStats = await stat(sourcePath);
    if (sourceStats.size > config.maxBytes) {
      throw new TranscriptionError(
        "The audio file exceeds the configured transcription size limit.",
        "TRANSCRIPTION_FILE_TOO_LARGE",
        false,
      );
    }

    const file = await readFile(sourcePath);
    const requestBody = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: source.mimeType,
                data: file.toString("base64"),
              },
            },
          ],
        },
      ],
      generationConfig: {
        audioTranscriptionConfig: {
          diarization: true,
          wordTimestamp: true,
        },
      },
    };

    let response: Response;
    try {
      response = await fetch(
        `${GEMINI_TRANSCRIPTION_URL}/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
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

    let payload: GeminiRawResponse;
    try {
      payload = (await response.json()) as GeminiRawResponse;
    } catch {
      throw new TranscriptionError(
        "Gemini returned an invalid transcription response.",
        "TRANSCRIPTION_INVALID_RESPONSE",
        true,
      );
    }

    return parseGeminiTranscriptionResponse(payload, {
      model: config.model,
      recordingId: config.recordingId,
      languageHint: config.languageHint,
    });
  } finally {
    if (converted) {
      await converted.cleanup();
    }
  }
}
