import {
  DEFAULT_STT_LANGUAGE_HINT,
  DEFAULT_WORKSPACE_ID,
  RECORDING_STATUSES,
  STT_LANGUAGE_HINTS,
  type RecordingStatus,
  type SttLanguageHint,
  type TranscriptProvider,
} from "@callmind/shared";
import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
} from "mongoose";

export interface RecordingMetadata {
  format?: string;
  codec?: string;
  sampleRate?: number;
  channels?: number;
  bitRate?: number;
}

export interface RecordingError {
  code?: string;
  message: string;
  occurredAt?: Date;
}

export interface RecordingTranscriptSegment {
  id?: string;
  index: number;
  start: number;
  end: number;
  text: string;
  speakerId: string | null;
}

export interface RecordingTranscript {
  id?: string;
  text: string;
  language: string;
  durationSeconds: number;
  provider: TranscriptProvider;
  model: string;
  processedAt: string;
  segments: RecordingTranscriptSegment[];
}

export interface RecordingRecord {
  workspaceId: string;
  originalFilename: string;
  storageKey: string;
  extension: string;
  detectedMimeType: string;
  sizeBytes: number;
  checksum: string;
  status: RecordingStatus;
  languageHint: SttLanguageHint;
  progress: number;
  durationSeconds: number | null;
  metadata: RecordingMetadata | null;
  error: RecordingError | null;
  attempts: number;
  transcriptionAttempts: number;
  transcript: RecordingTranscript | null;
  queuedAt: Date | null;
  processingStartedAt: Date | null;
  preparedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const recordingSchema = new Schema<RecordingRecord>(
  {
    workspaceId: {
      type: String,
      required: true,
      default: DEFAULT_WORKSPACE_ID,
      index: true,
    },
    originalFilename: { type: String, required: true },
    storageKey: { type: String, required: true },
    extension: { type: String, required: true },
    detectedMimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    checksum: { type: String, required: true },
    status: {
      type: String,
      enum: [...RECORDING_STATUSES],
      required: true,
      default: "uploaded",
      index: true,
    },
    languageHint: {
      type: String,
      enum: [...STT_LANGUAGE_HINTS],
      required: true,
      default: DEFAULT_STT_LANGUAGE_HINT,
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    durationSeconds: { type: Number, default: null, min: 0 },
    metadata: { type: Schema.Types.Mixed, default: null },
    error: { type: Schema.Types.Mixed, default: null },
    attempts: { type: Number, default: 0, min: 0 },
    transcriptionAttempts: { type: Number, default: 0, min: 0 },
    transcript: { type: Schema.Types.Mixed, default: null },
    queuedAt: { type: Date, default: null },
    processingStartedAt: { type: Date, default: null },
    preparedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// A recording is unique per workspace by content checksum.
recordingSchema.index({ workspaceId: 1, checksum: 1 }, { unique: true });
recordingSchema.index({ workspaceId: 1, createdAt: -1 });
recordingSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });

export type RecordingDocument = HydratedDocument<RecordingRecord>;

export const Recording: Model<RecordingRecord> =
  (models.Recording as Model<RecordingRecord> | undefined) ??
  model<RecordingRecord>("Recording", recordingSchema);
