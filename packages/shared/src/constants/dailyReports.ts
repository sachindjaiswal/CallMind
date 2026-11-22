export const DAILY_REPORT_STATUSES = [
  "queued",
  "generating",
  "completed",
  "failed",
] as const;

export type DailyReportStatus = (typeof DAILY_REPORT_STATUSES)[number];

export const DAILY_REPORT_GENERATION_PROVIDERS = ["system"] as const;
export type DailyReportGenerationProvider =
  (typeof DAILY_REPORT_GENERATION_PROVIDERS)[number];

export const DAILY_REPORT_CONFLICT_STATUSES = [
  "unresolved",
  "resolved",
  "dismissed",
] as const;
export type DailyReportConflictStatus =
  (typeof DAILY_REPORT_CONFLICT_STATUSES)[number];

export const DAILY_REPORT_REVIEWABLE_CONFLICT_STATUSES = [
  "resolved",
  "dismissed",
] as const;
export type ReviewableConflictStatus =
  (typeof DAILY_REPORT_REVIEWABLE_CONFLICT_STATUSES)[number];

export const DAILY_REPORT_EXPLICITNESS = ["explicit", "inferred"] as const;
export type DailyReportExplicitness = (typeof DAILY_REPORT_EXPLICITNESS)[number];

export const DAILY_REPORT_CONFIDENCE = ["low", "medium", "high"] as const;
export type DailyReportConfidence = (typeof DAILY_REPORT_CONFIDENCE)[number];

export const DAILY_REPORT_RELATIONSHIP_TYPES = [
  "shared_entity",
  "shared_topic",
  "task_update",
  "deadline_revision",
  "value_revision",
] as const;
export type DailyReportRelationshipType =
  (typeof DAILY_REPORT_RELATIONSHIP_TYPES)[number];

export const DAILY_REPORT_CONFLICT_TYPES = [
  "status_conflict",
  "date_conflict",
  "quantity_conflict",
] as const;
export type DailyReportConflictType =
  (typeof DAILY_REPORT_CONFLICT_TYPES)[number];

export const DAILY_REPORT_SCHEMA_VERSION = "daily-report-v1";
export const DAILY_REPORT_GENERATION_VERSION = "deterministic-v1";
export const DAILY_REPORT_DEFAULT_TIMEZONE = "UTC";
export const DAILY_REPORT_MAX_RECORDINGS = 100;
export const DAILY_REPORT_MAX_PAGE_LIMIT = 100;
export const DAILY_REPORT_DETAIL_MAX_LENGTH = 4_000;
export const DAILY_REPORT_NOTE_MAX_LENGTH = 1_000;
export const DAILY_REPORT_JOB_ATTEMPTS = 3;
export const DAILY_REPORT_JOB_BACKOFF_MS = 5_000;
