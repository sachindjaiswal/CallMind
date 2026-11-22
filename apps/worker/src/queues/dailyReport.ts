import {
  DAILY_REPORT_JOB_ATTEMPTS,
  DAILY_REPORT_SCHEMA_VERSION,
  QUEUES,
  conversationAnalysisSchema,
  isValidReportDate,
  isValidTimeZone,
  validateReportSources,
  DailyReportSourceValidationError,
  type DailyReportJobData,
  type DailyReportJobResult,
  type ValidatedReportSource,
} from "@callmind/shared";
import {
  ConversationAnalysis,
  DailyReport,
  Recording,
  type DailyReportRecord,
  type RecordingRecord,
  type RecordingTranscript,
} from "@callmind/db";
import { UnrecoverableError, type Job } from "bullmq";
import { isValidObjectId } from "mongoose";
import {
  ReportConsolidationError,
  consolidateRecordings,
} from "../lib/reportConsolidation";

export const DAILY_REPORT_QUEUE_NAME = QUEUES.DAILY_REPORT;

type DailyReportDocLike = DailyReportRecord & { _id: { toString(): string } };
type RecordingDocLike = RecordingRecord & { _id: { toString(): string } };
type AnalysisDocLike = {
  _id: { toString(): string };
  workspaceId: string;
  recordingId: string;
  status: string;
  analyzedAt: Date | null;
  summary: string | null;
  topics: string[];
  insights: unknown;
};
export type DailyReportJob = Job<DailyReportJobData, DailyReportJobResult>;

const CLAIMABLE_STATUSES: DailyReportRecord["status"][] = ["queued", "failed"];

function normalizeTranscript(
  recordingId: string,
  transcript: RecordingTranscript,
): RecordingTranscript {
  return {
    ...transcript,
    id: transcript.id ?? `tx-${recordingId}`,
    segments: transcript.segments.map((segment, index) => ({
      ...segment,
      id: segment.id ?? `seg-${recordingId}-${index}`,
    })),
  };
}

function errorDetails(error: unknown): {
  code: string;
  message: string;
  retryable: boolean;
} {
  if (error instanceof DailyReportSourceValidationError) {
    return { code: error.code, message: error.message, retryable: false };
  }

  if (error instanceof ReportConsolidationError) {
    return { code: error.code, message: error.message, retryable: false };
  }

  return {
    code: "DAILY_REPORT_FAILED",
    message: error instanceof Error ? error.message : "Unknown report error.",
    retryable: true,
  };
}

export function createDailyReportProcessor(): (
  job: DailyReportJob,
) => Promise<DailyReportJobResult> {
  return async (job) => {
    const reportId = job.data?.reportId;

    if (!reportId || !isValidObjectId(reportId)) {
      throw new UnrecoverableError("Invalid daily report id.");
    }

    const existing = (await DailyReport.findById(reportId).lean()) as
      | DailyReportDocLike
      | null;

    if (!existing) {
      throw new UnrecoverableError("Daily report not found.");
    }

    if (existing.status === "completed") {
      return {
        ok: true,
        reportId,
        skipped: true,
        insightCount: existing.consolidatedInsights.length,
        relationshipCount: existing.relationships.length,
        conflictCount: existing.conflicts.length,
      };
    }

    if (!CLAIMABLE_STATUSES.includes(existing.status)) {
      return { ok: true, reportId, skipped: true };
    }

    const claimed = (await DailyReport.findOneAndUpdate(
      { _id: reportId, status: { $in: CLAIMABLE_STATUSES } },
      {
        $set: { status: "generating", error: null },
        $inc: { attempts: 1 },
      },
      { new: true },
    ).lean()) as DailyReportDocLike | null;

    if (!claimed) {
      return { ok: true, reportId, skipped: true };
    }

    try {
      if (
        !isValidReportDate(claimed.reportDate) ||
        !isValidTimeZone(claimed.timezone)
      ) {
        throw new ReportConsolidationError(
          "REPORT_METADATA_INVALID",
          "Daily report has an invalid reporting date or timezone.",
        );
      }

      const recordingDocs = (await Recording.find({
        _id: { $in: claimed.selectedRecordingIds },
      }).lean()) as RecordingDocLike[];
      const analysisDocs = (await ConversationAnalysis.find({
        recordingId: { $in: claimed.selectedRecordingIds },
      }).lean()) as AnalysisDocLike[];

      const validated: ValidatedReportSource[] = validateReportSources({
        workspaceId: claimed.workspaceId,
        reportDate: claimed.reportDate,
        timezone: claimed.timezone,
        recordingIds: claimed.selectedRecordingIds,
        recordings: recordingDocs.map((recording) => ({
          id: recording._id.toString(),
          workspaceId: recording.workspaceId,
          status: recording.status,
          transcriptId: recording.transcript
            ? (recording.transcript.id ?? `tx-${recording._id.toString()}`)
            : null,
          createdAt: recording.createdAt,
        })),
        analyses: analysisDocs.map((analysis) => ({
          id: analysis._id.toString(),
          workspaceId: analysis.workspaceId,
          recordingId: analysis.recordingId,
          status: analysis.status,
          analyzedAt: analysis.analyzedAt,
        })),
      });

      const recordingById = new Map(
        recordingDocs.map((recording) => [recording._id.toString(), recording]),
      );
      const analysisById = new Map(
        analysisDocs.map((analysis) => [analysis._id.toString(), analysis]),
      );

      const sources = validated.map((source) => {
        const recording = recordingById.get(source.recordingId);
        const analysis = analysisById.get(source.analysisId);
        if (!recording?.transcript || !analysis?.summary) {
          throw new ReportConsolidationError(
            "REPORT_SOURCE_INCOMPLETE",
            `Recording ${source.recordingId} is missing transcript or analysis content.`,
          );
        }

        const parsed = conversationAnalysisSchema.safeParse({
          summary: analysis.summary,
          topics: analysis.topics ?? [],
          insights: analysis.insights ?? [],
        });

        if (!parsed.success) {
          throw new ReportConsolidationError(
            "REPORT_ANALYSIS_INVALID",
            `Analysis for recording ${source.recordingId} is invalid.`,
          );
        }

        return {
          source,
          analysis: {
            id: source.analysisId,
            summary: parsed.data.summary,
            insights: parsed.data.insights,
          },
          transcript: normalizeTranscript(
            source.recordingId,
            recording.transcript,
          ),
        };
      });

      const consolidation = consolidateRecordings({
        reportDate: claimed.reportDate,
        timezone: claimed.timezone,
        sources,
      });

      await DailyReport.updateOne(
        { _id: reportId },
        {
          $set: {
            status: "completed",
            sourceRecordings: consolidation.sourceRecordings,
            sourceAnalysisIds: consolidation.sourceAnalysisIds,
            overallSummary: consolidation.overallSummary,
            consolidatedInsights: consolidation.consolidatedInsights,
            relationships: consolidation.relationships,
            conflicts: consolidation.conflicts,
            provider: "system",
            schemaVersion: DAILY_REPORT_SCHEMA_VERSION,
            generatedAt: new Date(),
            error: null,
          },
        },
      );

      return {
        ok: true,
        reportId,
        insightCount: consolidation.consolidatedInsights.length,
        relationshipCount: consolidation.relationships.length,
        conflictCount: consolidation.conflicts.length,
      };
    } catch (error) {
      const details = errorDetails(error);
      const finalAttempt =
        !details.retryable ||
        job.attemptsMade + 1 >= (job.opts.attempts ?? DAILY_REPORT_JOB_ATTEMPTS);

      await DailyReport.updateOne(
        { _id: reportId },
        {
          $set: {
            status: "failed",
            error: {
              code: details.code,
              message: details.message,
              occurredAt: new Date(),
              retryable: details.retryable && !finalAttempt,
            },
          },
        },
      );

      if (!details.retryable) {
        throw new UnrecoverableError(details.message);
      }

      throw error instanceof Error ? error : new Error(details.message);
    }
  };
}
