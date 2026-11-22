export const RECORDING_STATUSES = [
  "uploaded",
  "queued",
  "processing",
  "ready_for_transcription",
  "transcription_queued",
  "transcribing",
  "transcribed",
  "analysis_queued",
  "analyzing",
  "analysis_completed",
  "analysis_failed",
  "failed",
] as const;

export type RecordingStatus = (typeof RECORDING_STATUSES)[number];

/** Statuses that still have background work pending. */
export const ACTIVE_RECORDING_STATUSES: RecordingStatus[] = [
  "uploaded",
  "queued",
  "processing",
  "ready_for_transcription",
  "transcription_queued",
  "transcribing",
  "analysis_queued",
  "analyzing",
];

export const SUPPORTED_AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "m4a",
  "mp4",
  "ogg",
  "oga",
  "flac",
  "webm",
  "weba",
] as const;

export type SupportedAudioExtension =
  (typeof SUPPORTED_AUDIO_EXTENSIONS)[number];

/**
 * Detected MIME types accepted for each extension. Detection is done from file
 * signatures, so browser-provided MIME types are never trusted.
 */
export const AUDIO_MIME_BY_EXTENSION: Record<
  SupportedAudioExtension,
  readonly string[]
> = {
  mp3: ["audio/mpeg", "audio/mp3"],
  wav: ["audio/wav", "audio/vnd.wave", "audio/x-wav"],
  m4a: ["audio/mp4", "video/mp4", "audio/x-m4a"],
  mp4: ["audio/mp4", "video/mp4", "video/3gpp"],
  ogg: ["audio/ogg", "application/ogg"],
  oga: ["audio/ogg", "application/ogg"],
  flac: ["audio/flac", "audio/x-flac"],
  webm: ["audio/webm", "video/webm"],
  weba: ["audio/webm", "video/webm"],
};

export const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024;
export const DEFAULT_MAX_UPLOAD_BYTES = MAX_AUDIO_UPLOAD_BYTES;
export const DEFAULT_GROQ_STT_MAX_BYTES = MAX_AUDIO_UPLOAD_BYTES;
export const DEFAULT_MAX_FILES_PER_UPLOAD = 20;
export const DEFAULT_WORKSPACE_ID = "default";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-3.1-flash-lite";
export const DEFAULT_GROQ_STT_MODEL = "whisper-large-v3-turbo";
export const DEFAULT_GEMINI_STT_MODEL = "gemini-3.5-transcribe";
export const DEFAULT_GEMINI_STT_MAX_BYTES = MAX_AUDIO_UPLOAD_BYTES;
export const DEFAULT_STT_STRATEGY = "language-aware";
export const DEFAULT_STT_LANGUAGE_HINT = "auto";

export const STT_STRATEGIES = ["groq-only", "language-aware"] as const;
export type SttStrategy = (typeof STT_STRATEGIES)[number];

export const STT_LANGUAGE_HINTS = ["auto", "en", "hi"] as const;
export type SttLanguageHint = (typeof STT_LANGUAGE_HINTS)[number];

export const STT_LANGUAGE_HINT_LABELS = {
  auto: "Auto (Gemini Transcribe)",
  en: "English (Groq Turbo)",
  hi: "Hindi / other (Gemini Transcribe)",
} as const satisfies Record<SttLanguageHint, string>;

export const TRANSCRIPT_PROVIDERS = ["groq", "gemini"] as const;
export type TranscriptProvider = (typeof TRANSCRIPT_PROVIDERS)[number];

export const ANALYSIS_PROVIDERS = ["gemini"] as const;
export type AnalysisProvider = (typeof ANALYSIS_PROVIDERS)[number];

export const ANALYSIS_STATUSES = [
  "queued",
  "analyzing",
  "completed",
  "failed",
] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const ANALYSIS_SCHEMA_VERSION = "conversation-insights-v2";
export const ANALYSIS_PROMPT_VERSION = "conversation-analysis-v2";

/** BullMQ attempt count for recording preparation jobs. */
export const RECORDING_JOB_ATTEMPTS = 3;
export const RECORDING_JOB_BACKOFF_MS = 5_000;
export const TRANSCRIPTION_JOB_ATTEMPTS = 3;
export const TRANSCRIPTION_JOB_BACKOFF_MS = 5_000;
export const ANALYSIS_JOB_ATTEMPTS = 2;
export const ANALYSIS_JOB_BACKOFF_MS = 5_000;
export const GEMINI_MODEL_ATTEMPTS = 2;
export const GEMINI_RETRY_BASE_MS = 500;
export const GEMINI_TIMEOUT_MS = 120_000;

export function isSupportedAudioExtension(
  value: string,
): value is SupportedAudioExtension {
  return (SUPPORTED_AUDIO_EXTENSIONS as readonly string[]).includes(
    value.toLowerCase(),
  );
}
