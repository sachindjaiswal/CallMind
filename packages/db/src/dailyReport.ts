import {
  DAILY_REPORT_GENERATION_PROVIDERS,
  DAILY_REPORT_SCHEMA_VERSION,
  DAILY_REPORT_STATUSES,
  DEFAULT_WORKSPACE_ID,
  type ConsolidatedInsight,
  type DailyReportConflict,
  type DailyReportError,
  type DailyReportGenerationProvider,
  type DailyReportRelationship,
  type DailyReportSourceRecording,
  type DailyReportStatus,
} from "@callmind/shared";
import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
} from "mongoose";

export interface DailyReportRecord {
  workspaceId: string;
  reportDate: string;
  timezone: string;
  status: DailyReportStatus;
  selectedRecordingIds: string[];
  sourceRecordings: DailyReportSourceRecording[];
  sourceAnalysisIds: string[];
  overallSummary: string;
  consolidatedInsights: ConsolidatedInsight[];
  relationships: DailyReportRelationship[];
  conflicts: DailyReportConflict[];
  provider: DailyReportGenerationProvider;
  model: string;
  schemaVersion: string;
  generationVersion: string;
  requestFingerprint: string;
  previousReportId: string | null;
  attempts: number;
  error: DailyReportError | null;
  generatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const dailyReportSchema = new Schema<DailyReportRecord>(
  {
    workspaceId: {
      type: String,
      required: true,
      default: DEFAULT_WORKSPACE_ID,
      index: true,
    },
    reportDate: { type: String, required: true, index: true },
    timezone: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: [...DAILY_REPORT_STATUSES],
      required: true,
      default: "queued",
      index: true,
    },
    selectedRecordingIds: { type: [String], required: true },
    sourceRecordings: { type: Schema.Types.Mixed, default: [] },
    sourceAnalysisIds: { type: [String], default: [] },
    overallSummary: { type: String, default: "" },
    consolidatedInsights: { type: Schema.Types.Mixed, default: [] },
    relationships: { type: Schema.Types.Mixed, default: [] },
    conflicts: { type: Schema.Types.Mixed, default: [] },
    provider: {
      type: String,
      enum: [...DAILY_REPORT_GENERATION_PROVIDERS],
      required: true,
      default: "system",
    },
    model: { type: String, required: true, default: "deterministic-v1" },
    schemaVersion: {
      type: String,
      required: true,
      default: DAILY_REPORT_SCHEMA_VERSION,
    },
    generationVersion: { type: String, required: true },
    requestFingerprint: { type: String, required: true },
    previousReportId: { type: String, default: null },
    attempts: { type: Number, default: 0, min: 0 },
    error: { type: Schema.Types.Mixed, default: null },
    generatedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

dailyReportSchema.index(
  { workspaceId: 1, requestFingerprint: 1 },
  { unique: true, name: "daily_report_request_unique" },
);
dailyReportSchema.index(
  { workspaceId: 1, reportDate: 1, timezone: 1, createdAt: -1 },
  { name: "daily_report_workspace_date" },
);
dailyReportSchema.index(
  { workspaceId: 1, status: 1, createdAt: -1 },
  { name: "daily_report_workspace_status" },
);
dailyReportSchema.index(
  { workspaceId: 1, selectedRecordingIds: 1 },
  { name: "daily_report_selected_recordings" },
);
dailyReportSchema.index(
  { workspaceId: 1, previousReportId: 1 },
  { name: "daily_report_previous" },
);

export type DailyReportDocument = HydratedDocument<DailyReportRecord>;

export const DailyReport: Model<DailyReportRecord> =
  (models.DailyReport as Model<DailyReportRecord> | undefined) ??
  model<DailyReportRecord>("DailyReport", dailyReportSchema);
