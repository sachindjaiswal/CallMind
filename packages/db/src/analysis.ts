import {
  ANALYSIS_PROVIDERS,
  ANALYSIS_STATUSES,
  DEFAULT_WORKSPACE_ID,
  type AnalysisProvider,
  type AnalysisStatus,
  type ConversationInsight,
} from "@callmind/shared";
import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
} from "mongoose";

export interface AnalysisError {
  code?: string;
  message: string;
  occurredAt?: Date;
}

export interface ConversationAnalysisRecord {
  workspaceId: string;
  recordingId: string;
  transcriptId: string;
  status: AnalysisStatus;
  provider: AnalysisProvider;
  model: string;
  fallbackUsed: boolean;
  attemptedModels: string[];
  schemaVersion: string;
  promptVersion: string;
  summary: string | null;
  topics: string[];
  insights: ConversationInsight[];
  error: AnalysisError | null;
  analyzedAt: Date | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const analysisSchema = new Schema<ConversationAnalysisRecord>(
  {
    workspaceId: {
      type: String,
      required: true,
      default: DEFAULT_WORKSPACE_ID,
      index: true,
    },
    recordingId: { type: String, required: true, index: true },
    transcriptId: { type: String, required: true },
    status: {
      type: String,
      enum: [...ANALYSIS_STATUSES],
      required: true,
      default: "queued",
      index: true,
    },
    provider: {
      type: String,
      enum: [...ANALYSIS_PROVIDERS],
      required: true,
      default: "gemini",
    },
    model: { type: String, required: true },
    fallbackUsed: { type: Boolean, default: false },
    attemptedModels: { type: [String], default: [] },
    schemaVersion: { type: String, required: true },
    promptVersion: { type: String, required: true },
    summary: { type: String, default: null },
    topics: { type: [String], default: [] },
    insights: { type: Schema.Types.Mixed, default: [] },
    error: { type: Schema.Types.Mixed, default: null },
    analyzedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

analysisSchema.index(
  { workspaceId: 1, recordingId: 1 },
  { unique: true, name: "analysis_workspace_recording_unique" },
);
analysisSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });

export type ConversationAnalysisDocument =
  HydratedDocument<ConversationAnalysisRecord>;

export const ConversationAnalysis: Model<ConversationAnalysisRecord> =
  (models.ConversationAnalysis as Model<ConversationAnalysisRecord> | undefined) ??
  model<ConversationAnalysisRecord>(
    "ConversationAnalysis",
    analysisSchema,
  );
