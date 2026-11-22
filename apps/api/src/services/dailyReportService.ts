import {
  DAILY_REPORT_GENERATION_VERSION,
  DAILY_REPORT_MAX_RECORDINGS,
  DAILY_REPORT_SCHEMA_VERSION,
  DailyReportSourceValidationError,
  dailyReportDtoSchema,
  isValidReportDate,
  isValidTimeZone,
  toSourceRecordingDtos,
  validateReportSources,
  type DailyReportConflict,
  type DailyReportConflictDecision,
  type DailyReportDto,
  type DailyReportGenerateRequest,
  type DailyReportListQuery,
  type DailyReportListResponse,
} from "@callmind/shared";
import {
  ConversationAnalysis,
  DailyReport,
  Recording,
  type ConversationAnalysisRecord,
  type DailyReportRecord,
  type RecordingRecord,
} from "@callmind/db";
import { createHash, randomUUID } from "node:crypto";
import type { FilterQuery } from "mongoose";
import { ApiError } from "../lib/apiError";

type DailyReportDocLike = DailyReportRecord & { _id: { toString(): string } };
type RecordingDocLike = RecordingRecord & { _id: { toString(): string } };
type AnalysisDocLike = ConversationAnalysisRecord & {
  _id: { toString(): string };
};

export interface DailyReportServiceOptions {
  workspaceId: string;
  enqueueReport: (reportId: string) => Promise<void>;
}

function toIso(value: Date): string {
  return value.toISOString();
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value instanceof Date ? toIso(value) : value;
}

function toDto(doc: DailyReportDocLike): DailyReportDto {
  return dailyReportDtoSchema.parse({
    ...doc,
    id: doc._id.toString(),
    conflicts: doc.conflicts.map((conflict) => ({
      ...conflict,
      reviewedAt: toIsoOrNull(conflict.reviewedAt as Date | string | null),
    })),
    error: doc.error
      ? {
          ...doc.error,
          occurredAt: toIsoOrNull(
            doc.error.occurredAt as unknown as Date | string | null,
          ),
        }
      : null,
    generatedAt: doc.generatedAt ? toIso(doc.generatedAt) : null,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  });
}

function duplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

function requestFingerprint(input: {
  workspaceId: string;
  reportDate: string;
  timezone: string;
  recordingIds: string[];
  previousReportId: string | null;
  nonce: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        workspaceId: input.workspaceId,
        reportDate: input.reportDate,
        timezone: input.timezone,
        recordingIds: input.recordingIds,
        previousReportId: input.previousReportId,
        nonce: input.nonce,
      }),
    )
    .digest("hex");
}

export function createDailyReportService({
  workspaceId,
  enqueueReport,
}: DailyReportServiceOptions) {
  async function validateSources(input: DailyReportGenerateRequest) {
    const recordingDocs = (await Recording.find({
      _id: { $in: input.recordingIds },
    }).lean()) as RecordingDocLike[];
    const analysisDocs = (await ConversationAnalysis.find({
      recordingId: { $in: input.recordingIds },
    }).lean()) as AnalysisDocLike[];

    try {
      return validateReportSources({
        workspaceId,
        reportDate: input.reportDate,
        timezone: input.timezone,
        recordingIds: input.recordingIds,
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
    } catch (error) {
      if (error instanceof DailyReportSourceValidationError) {
        throw new ApiError(
          400,
          error.code,
          error.message,
          error.details,
        );
      }
      throw error;
    }
  }

  async function createQueuedReport(
    input: DailyReportGenerateRequest,
    previousReportId: string | null,
    allowRegeneration = false,
  ): Promise<DailyReportDto> {
    const validated = await validateSources(input);
    const fingerprint = requestFingerprint({
      workspaceId,
      reportDate: input.reportDate,
      timezone: input.timezone,
      recordingIds: input.recordingIds,
      previousReportId,
      nonce: allowRegeneration ? randomUUID() : "",
    });

    let created: DailyReportDocLike;
    try {
      const createdDoc = await DailyReport.create({
        workspaceId,
        reportDate: input.reportDate,
        timezone: input.timezone,
        status: "queued",
        selectedRecordingIds: input.recordingIds,
        sourceRecordings: toSourceRecordingDtos(validated),
        sourceAnalysisIds: validated.map((source) => source.analysisId),
        overallSummary: "",
        consolidatedInsights: [],
        relationships: [],
        conflicts: [],
        provider: "system",
        model: DAILY_REPORT_GENERATION_VERSION,
        schemaVersion: DAILY_REPORT_SCHEMA_VERSION,
        generationVersion: DAILY_REPORT_GENERATION_VERSION,
        requestFingerprint: fingerprint,
        previousReportId,
        attempts: 0,
        error: null,
        generatedAt: null,
      });
      created = createdDoc.toObject() as DailyReportDocLike;
    } catch (error) {
      if (duplicateKeyError(error)) {
        const existing = (await DailyReport.findOne({
          workspaceId,
          requestFingerprint: fingerprint,
        }).lean()) as DailyReportDocLike | null;
        throw new ApiError(
          409,
          "REPORT_DUPLICATE_REQUEST",
          "An identical daily report generation request already exists.",
          { reportId: existing?._id.toString() ?? null },
        );
      }
      throw error;
    }

    try {
      await enqueueReport(created._id.toString());
    } catch (error) {
      await DailyReport.updateOne(
        { _id: created._id },
        {
          $set: {
            status: "failed",
            error: {
              code: "REPORT_QUEUE_UNAVAILABLE",
              message: "The report could not be queued for generation.",
              occurredAt: new Date(),
              retryable: true,
            },
          },
        },
      );
      throw new ApiError(
        503,
        "REPORT_QUEUE_UNAVAILABLE",
        "The report could not be queued for generation.",
      );
    }

    return toDto(created);
  }

  function verifyReportId(id: string): void {
    if (!/^[a-f\d]{24}$/i.test(id)) {
      throw new ApiError(
        400,
        "INVALID_REPORT_ID",
        "The daily report id is invalid.",
      );
    }
  }

  async function findReport(id: string): Promise<DailyReportDocLike> {
    verifyReportId(id);
    const doc = (await DailyReport.findOne({
      _id: id,
      workspaceId,
    }).lean()) as DailyReportDocLike | null;

    if (!doc) {
      throw new ApiError(404, "REPORT_NOT_FOUND", "Daily report not found.");
    }

    return doc;
  }

  return {
    async generate(input: DailyReportGenerateRequest): Promise<DailyReportDto> {
      if (
        !isValidReportDate(input.reportDate) ||
        !isValidTimeZone(input.timezone)
      ) {
        throw new ApiError(
          400,
          "INVALID_REPORT_REQUEST",
          "The reporting date or timezone is invalid.",
        );
      }
      if (
        input.recordingIds.length === 0 ||
        input.recordingIds.length > DAILY_REPORT_MAX_RECORDINGS ||
        new Set(input.recordingIds).size !== input.recordingIds.length
      ) {
        throw new ApiError(
          400,
          "INVALID_REPORT_REQUEST",
          "Select between 1 and 100 unique recordings.",
        );
      }
      return createQueuedReport(input, null);
    },

    async list(query: DailyReportListQuery): Promise<DailyReportListResponse> {
      if (query.from && query.to && query.from > query.to) {
        throw new ApiError(
          400,
          "INVALID_QUERY",
          "The from date must not be after the to date.",
        );
      }

      const filter: FilterQuery<DailyReportRecord> = { workspaceId };
      if (query.reportDate) {
        filter.reportDate = query.reportDate;
      }
      if (query.from || query.to) {
        filter.reportDate = {
          ...(query.from ? { $gte: query.from } : {}),
          ...(query.to ? { $lte: query.to } : {}),
        };
      }
      if (query.status) {
        filter.status = query.status;
      }

      const [docs, total] = await Promise.all([
        DailyReport.find(filter)
          .sort({ createdAt: -1 })
          .skip((query.page - 1) * query.limit)
          .limit(query.limit)
          .lean() as Promise<DailyReportDocLike[]>,
        DailyReport.countDocuments(filter),
      ]);

      return {
        items: docs.map(toDto),
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      };
    },

    async getById(id: string): Promise<DailyReportDto> {
      return toDto(await findReport(id));
    },

    async listConflicts(id: string): Promise<DailyReportConflict[]> {
      return (await findReport(id)).conflicts;
    },

    async updateConflict(
      id: string,
      conflictId: string,
      decision: DailyReportConflictDecision,
    ): Promise<DailyReportConflict> {
      await findReport(id);
      const updated = (await DailyReport.findOneAndUpdate(
        {
          _id: id,
          workspaceId,
          "conflicts.id": conflictId,
        },
        {
          $set: {
            "conflicts.$.status": decision.status,
            "conflicts.$.reviewerNote": decision.reviewerNote,
            "conflicts.$.reviewedAt": new Date(),
          },
        },
        { new: true },
      ).lean()) as DailyReportDocLike | null;

      if (!updated) {
        throw new ApiError(
          404,
          "REPORT_CONFLICT_NOT_FOUND",
          "Daily report conflict not found.",
        );
      }

      const dto = toDto(updated);
      const conflict = dto.conflicts.find((item) => item.id === conflictId);
      if (!conflict) {
        throw new ApiError(
          404,
          "REPORT_CONFLICT_NOT_FOUND",
          "Daily report conflict not found.",
        );
      }
      return conflict;
    },

    async regenerate(id: string): Promise<DailyReportDto> {
      const previous = await findReport(id);
      if (!isValidReportDate(previous.reportDate) || !isValidTimeZone(previous.timezone)) {
        throw new ApiError(
          409,
          "REPORT_INVALID_PREVIOUS",
          "The previous daily report has invalid date metadata.",
        );
      }

      return createQueuedReport(
        {
          reportDate: previous.reportDate,
          timezone: previous.timezone,
          recordingIds: previous.selectedRecordingIds,
        },
        previous._id.toString(),
        true,
      );
    },
  };
}

export type DailyReportService = ReturnType<typeof createDailyReportService>;
