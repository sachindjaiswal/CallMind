import { z } from "zod";
import {
  DAILY_REPORT_CONFLICT_STATUSES,
  DAILY_REPORT_CONFLICT_TYPES,
  DAILY_REPORT_CONFIDENCE,
  DAILY_REPORT_DETAIL_MAX_LENGTH,
  DAILY_REPORT_EXPLICITNESS,
  DAILY_REPORT_GENERATION_PROVIDERS,
  DAILY_REPORT_MAX_PAGE_LIMIT,
  DAILY_REPORT_MAX_RECORDINGS,
  DAILY_REPORT_NOTE_MAX_LENGTH,
  DAILY_REPORT_RELATIONSHIP_TYPES,
  DAILY_REPORT_STATUSES,
} from "../constants/dailyReports";
import { INSIGHT_CATEGORIES } from "./analysis";
import {
  isValidReportDate,
  isValidTimeZone,
} from "../utils/datetime";

const detail = () => z.string().trim().min(1).max(DAILY_REPORT_DETAIL_MAX_LENGTH);
const nullableDetail = () =>
  z
    .string()
    .trim()
    .min(1)
    .max(DAILY_REPORT_DETAIL_MAX_LENGTH)
    .nullable()
    .optional()
    .transform((value) => value ?? null);

export const dailyReportReportDateSchema = z
  .string()
  .refine(isValidReportDate, { message: "Use a valid YYYY-MM-DD reporting date." });

export const dailyReportTimezoneSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isValidTimeZone, { message: "Use a valid IANA timezone." });

export const dailyReportGenerateRequestSchema = z
  .object({
    reportDate: dailyReportReportDateSchema,
    timezone: dailyReportTimezoneSchema,
    recordingIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(DAILY_REPORT_MAX_RECORDINGS),
  })
  .refine(
    (value) => new Set(value.recordingIds).size === value.recordingIds.length,
    { message: "recordingIds must not contain duplicates.", path: ["recordingIds"] },
  );

export type DailyReportGenerateRequest = z.infer<
  typeof dailyReportGenerateRequestSchema
>;

export const dailyReportListQuerySchema = z.object({
  reportDate: dailyReportReportDateSchema.optional(),
  status: z.enum(DAILY_REPORT_STATUSES).optional(),
  from: dailyReportReportDateSchema.optional(),
  to: dailyReportReportDateSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(DAILY_REPORT_MAX_PAGE_LIMIT).default(20),
});

export type DailyReportListQuery = z.infer<typeof dailyReportListQuerySchema>;

export const dailyReportIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const dailyReportConflictParamsSchema = z.object({
  id: z.string().trim().min(1),
  conflictId: z.string().trim().min(1),
});

export const dailyReportConflictDecisionSchema = z.object({
  status: z.enum(["resolved", "dismissed"]),
  reviewerNote: z
    .string()
    .trim()
    .max(DAILY_REPORT_NOTE_MAX_LENGTH)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export type DailyReportConflictDecision = z.infer<
  typeof dailyReportConflictDecisionSchema
>;

export const reportEvidenceSchema = z.object({
  insightId: z.string().min(1),
  analysisId: z.string().min(1),
  recordingId: z.string().min(1),
  segmentId: z.string().min(1).nullable(),
  segmentIndex: z.number().int().nonnegative().nullable(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  quote: detail(),
});

export type ReportEvidence = z.infer<typeof reportEvidenceSchema>;

export const reportConflictValueSchema = z.object({
  value: detail(),
  insightId: z.string().min(1),
  recordingId: z.string().min(1),
  evidence: reportEvidenceSchema,
});

export type ReportConflictValue = z.infer<typeof reportConflictValueSchema>;

export const consolidatedInsightSchema = z.object({
  id: detail(),
  category: z.enum(INSIGHT_CATEGORIES),
  summary: detail(),
  explicitness: z.enum(DAILY_REPORT_EXPLICITNESS),
  confidence: z.enum(DAILY_REPORT_CONFIDENCE),
  sourceInsightIds: z.array(z.string().min(1)),
  sourceRecordingIds: z.array(z.string().min(1)),
  evidence: z.array(reportEvidenceSchema),
});

export type ConsolidatedInsight = z.infer<typeof consolidatedInsightSchema>;

export const dailyReportRelationshipSchema = z.object({
  id: detail(),
  type: z.enum(DAILY_REPORT_RELATIONSHIP_TYPES),
  summary: detail(),
  explanation: detail(),
  explicitness: z.enum(DAILY_REPORT_EXPLICITNESS),
  confidence: z.enum(DAILY_REPORT_CONFIDENCE),
  sourceInsightIds: z.array(z.string().min(1)),
  sourceRecordingIds: z.array(z.string().min(1)),
  evidence: z.array(reportEvidenceSchema),
  reviewStatus: z.enum(["pending", "accepted", "dismissed"]),
});

export type DailyReportRelationship = z.infer<typeof dailyReportRelationshipSchema>;

export const dailyReportConflictSchema = z.object({
  id: detail(),
  type: z.enum(DAILY_REPORT_CONFLICT_TYPES),
  summary: detail(),
  explanation: detail(),
  explicitness: z.enum(DAILY_REPORT_EXPLICITNESS),
  confidence: z.enum(DAILY_REPORT_CONFIDENCE),
  sourceInsightIds: z.array(z.string().min(1)),
  sourceRecordingIds: z.array(z.string().min(1)),
  values: z.array(reportConflictValueSchema).min(2),
  status: z.enum(DAILY_REPORT_CONFLICT_STATUSES),
  reviewerNote: z.string().max(DAILY_REPORT_NOTE_MAX_LENGTH).nullable(),
  reviewedAt: z.string().nullable(),
});

export type DailyReportConflict = z.infer<typeof dailyReportConflictSchema>;

export const dailyReportSourceRecordingSchema = z.object({
  recordingId: z.string().min(1),
  transcriptId: z.string().min(1),
  analysisId: z.string().min(1),
  createdAt: z.string(),
  analyzedAt: z.string(),
});

export type DailyReportSourceRecording = z.infer<
  typeof dailyReportSourceRecordingSchema
>;

export const dailyReportErrorSchema = z.object({
  code: detail(),
  message: detail(),
  occurredAt: z.string(),
  retryable: z.boolean(),
});

export type DailyReportError = z.infer<typeof dailyReportErrorSchema>;

export const dailyReportDtoSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  reportDate: dailyReportReportDateSchema,
  timezone: dailyReportTimezoneSchema,
  status: z.enum(DAILY_REPORT_STATUSES),
  selectedRecordingIds: z.array(z.string().min(1)),
  sourceRecordings: z.array(dailyReportSourceRecordingSchema),
  sourceAnalysisIds: z.array(z.string().min(1)),
  overallSummary: z.string(),
  consolidatedInsights: z.array(consolidatedInsightSchema),
  relationships: z.array(dailyReportRelationshipSchema),
  conflicts: z.array(dailyReportConflictSchema),
  provider: z.enum(DAILY_REPORT_GENERATION_PROVIDERS),
  model: z.string(),
  schemaVersion: z.string(),
  generationVersion: z.string(),
  requestFingerprint: z.string(),
  previousReportId: z.string().nullable(),
  attempts: z.number().int().nonnegative(),
  error: dailyReportErrorSchema.nullable(),
  generatedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DailyReportDto = z.infer<typeof dailyReportDtoSchema>;

export const dailyReportListResponseSchema = z.object({
  items: z.array(dailyReportDtoSchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type DailyReportListResponse = z.infer<
  typeof dailyReportListResponseSchema
>;

export type DailyReportConsolidation = Pick<
  DailyReportDto,
  | "overallSummary"
  | "sourceRecordings"
  | "sourceAnalysisIds"
  | "consolidatedInsights"
  | "relationships"
  | "conflicts"
>;
