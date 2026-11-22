import { z } from "zod";
import {
  RECORDING_STATUSES,
  STT_LANGUAGE_HINTS,
  TRANSCRIPT_PROVIDERS,
} from "../constants/recordings";
import { analysisDtoSchema } from "./analysis";

export const recordingStatusSchema = z.enum(RECORDING_STATUSES);

export const sttLanguageHintSchema = z.enum(STT_LANGUAGE_HINTS);

export const recordingErrorSchema = z.object({
  code: z.string().optional(),
  message: z.string(),
  occurredAt: z.string().optional(),
});

export const recordingMetadataSchema = z.object({
  format: z.string().optional(),
  codec: z.string().optional(),
  sampleRate: z.number().optional(),
  channels: z.number().optional(),
  bitRate: z.number().optional(),
});

export const transcriptSegmentSchema = z.object({
  id: z.string(),
  index: z.number().int().nonnegative(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  text: z.string(),
  speakerId: z.string().nullable(),
});

export const transcriptSchema = z.object({
  id: z.string(),
  text: z.string(),
  language: z.string(),
  durationSeconds: z.number().nonnegative(),
  provider: z.enum(TRANSCRIPT_PROVIDERS),
  model: z.string(),
  processedAt: z.string(),
  segments: z.array(transcriptSegmentSchema),
});

export type TranscriptSegmentDto = z.infer<typeof transcriptSegmentSchema>;
export type TranscriptDto = z.infer<typeof transcriptSchema>;

export const recordingDtoSchema = z.object({
  id: z.string(),
  originalFilename: z.string(),
  mimeType: z.string(),
  extension: z.string(),
  sizeBytes: z.number().nonnegative(),
  checksum: z.string(),
  status: recordingStatusSchema,
  languageHint: sttLanguageHintSchema,
  progress: z.number().min(0).max(100),
  durationSeconds: z.number().nonnegative().nullable(),
  metadata: recordingMetadataSchema.nullable(),
  error: recordingErrorSchema.nullable(),
  attempts: z.number().int().nonnegative(),
  transcriptionAttempts: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  preparedAt: z.string().nullable(),
  transcript: transcriptSchema.nullable(),
  analysis: analysisDtoSchema.nullable(),
});

export type RecordingDto = z.infer<typeof recordingDtoSchema>;

export const uploadFileStatusSchema = z.enum([
  "created",
  "duplicate",
  "rejected",
]);

export const uploadFileResultSchema = z.object({
  originalFilename: z.string(),
  status: uploadFileStatusSchema,
  recording: recordingDtoSchema.nullable(),
  duplicateOf: z.string().nullable(),
  error: recordingErrorSchema.nullable(),
});

export type UploadFileResult = z.infer<typeof uploadFileResultSchema>;

export const uploadResponseSchema = z.object({
  results: z.array(uploadFileResultSchema),
  summary: z.object({
    created: z.number().int().nonnegative(),
    duplicate: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
  }),
});

export type UploadResponse = z.infer<typeof uploadResponseSchema>;

export const recordingListResponseSchema = z.object({
  items: z.array(recordingDtoSchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type RecordingListResponse = z.infer<
  typeof recordingListResponseSchema
>;

export const recordingListQuerySchema = z.object({
  status: recordingStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const recordingConfigSchema = z.object({
  maxFileSizeBytes: z.number().int().positive(),
  maxFilesPerUpload: z.number().int().positive(),
  supportedExtensions: z.array(z.string()),
  supportedLanguageHints: z.array(z.string()),
});

export type RecordingConfig = z.infer<typeof recordingConfigSchema>;

export const recordingIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const RECORDING_STATUS_LABELS = {
  uploaded: "Uploaded",
  queued: "Queued for preparation",
  processing: "Preparing audio",
  ready_for_transcription: "Prepared",
  transcription_queued: "Queued for transcription",
  transcribing: "Transcribing audio",
  transcribed: "Transcribed",
  analysis_queued: "Waiting for analysis",
  analyzing: "Analysing conversation",
  analysis_completed: "Analysis completed",
  analysis_failed: "Analysis failed",
  failed: "Failed",
} as const satisfies Record<(typeof RECORDING_STATUSES)[number], string>;
