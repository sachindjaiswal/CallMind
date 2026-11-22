import { isInstantInReportDate } from "../utils/datetime";
import type { DailyReportSourceRecording } from "../schemas/dailyReports";

export interface ReportRecordingCandidate {
  id: string;
  workspaceId: string;
  status: string;
  transcriptId: string | null;
  createdAt: Date | string;
}

export interface ReportAnalysisCandidate {
  id: string;
  workspaceId: string;
  recordingId: string;
  status: string;
  analyzedAt: Date | string | null;
}

export interface ValidatedReportSource {
  recordingId: string;
  transcriptId: string;
  analysisId: string;
  createdAt: string;
  analyzedAt: string;
}

export class DailyReportSourceValidationError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "DailyReportSourceValidationError";
    this.code = code;
    this.details = details;
  }
}

function iso(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

export interface ValidateReportSourcesInput {
  workspaceId: string;
  reportDate: string;
  timezone: string;
  recordingIds: string[];
  recordings: ReportRecordingCandidate[];
  analyses: ReportAnalysisCandidate[];
}

export function validateReportSources({
  workspaceId,
  reportDate,
  timezone,
  recordingIds,
  recordings,
  analyses,
}: ValidateReportSourcesInput): ValidatedReportSource[] {
  const recordingById = new Map(recordings.map((item) => [item.id, item]));
  const analysisByRecordingId = new Map(
    analyses.map((item) => [item.recordingId, item]),
  );

  return recordingIds.map((recordingId) => {
    const recording = recordingById.get(recordingId);
    if (!recording) {
      throw new DailyReportSourceValidationError(
        "RECORDING_NOT_FOUND",
        `Recording ${recordingId} was not found.`,
        { recordingId },
      );
    }
    if (recording.workspaceId !== workspaceId) {
      throw new DailyReportSourceValidationError(
        "CROSS_WORKSPACE_RECORDING",
        `Recording ${recordingId} belongs to another workspace.`,
        { recordingId },
      );
    }
    if (recording.status !== "analysis_completed") {
      throw new DailyReportSourceValidationError(
        "RECORDING_NOT_READY",
        `Recording ${recordingId} has no completed analysis.`,
        { recordingId, status: recording.status },
      );
    }
    if (!recording.transcriptId) {
      throw new DailyReportSourceValidationError(
        "TRANSCRIPT_MISSING",
        `Recording ${recordingId} has no linked transcript.`,
        { recordingId },
      );
    }
    if (!isInstantInReportDate(recording.createdAt, reportDate, timezone)) {
      throw new DailyReportSourceValidationError(
        "RECORDING_OUTSIDE_REPORT_DATE",
        `Recording ${recordingId} is outside the selected reporting date and timezone.`,
        {
          recordingId,
          reportDate,
          timezone,
          createdAt: iso(recording.createdAt),
        },
      );
    }

    const analysis = analysisByRecordingId.get(recordingId);
    if (!analysis) {
      throw new DailyReportSourceValidationError(
        "ANALYSIS_NOT_FOUND",
        `Recording ${recordingId} has no analysis document.`,
        { recordingId },
      );
    }
    if (analysis.workspaceId !== workspaceId) {
      throw new DailyReportSourceValidationError(
        "CROSS_WORKSPACE_ANALYSIS",
        `Analysis for recording ${recordingId} belongs to another workspace.`,
        { recordingId, analysisId: analysis.id },
      );
    }
    if (analysis.status !== "completed" || !analysis.analyzedAt) {
      throw new DailyReportSourceValidationError(
        "ANALYSIS_NOT_COMPLETED",
        `Analysis for recording ${recordingId} is not completed.`,
        { recordingId, analysisId: analysis.id, status: analysis.status },
      );
    }

    return {
      recordingId,
      transcriptId: recording.transcriptId,
      analysisId: analysis.id,
      createdAt: iso(recording.createdAt),
      analyzedAt: iso(analysis.analyzedAt),
    };
  });
}

export function toSourceRecordingDtos(
  sources: ValidatedReportSource[],
): DailyReportSourceRecording[] {
  return sources.map((source) => ({ ...source }));
}
