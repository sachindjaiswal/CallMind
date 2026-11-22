import type {
  AnalysisDto,
  RecordingConfig,
  RecordingDto,
  RecordingListResponse,
  TranscriptDto,
  UploadFileResult,
} from "@callmind/shared";
import {
  DEFAULT_STT_LANGUAGE_HINT,
  STT_LANGUAGE_HINTS,
  SUPPORTED_AUDIO_EXTENSIONS,
  type RecordingStatus,
  type SttLanguageHint,
} from "@callmind/shared";
import {
  ConversationAnalysis as AnalysisModel,
  Recording,
  type ConversationAnalysisRecord,
  type RecordingDocument,
  type RecordingError,
  type RecordingMetadata,
  type RecordingRecord,
} from "@callmind/db";
import { isValidObjectId, type FilterQuery } from "mongoose";
import type { z } from "zod";
import type { recordingListQuerySchema } from "@callmind/shared";
import { ApiError } from "../lib/apiError";
import { computeSha256 } from "../lib/checksum";
import {
  buildStorageKey,
  moveIntoStorage,
  removeFileIfExists,
  resolveStoragePath,
} from "../lib/storage";
import { validateAudioFile } from "./audioValidation";

export interface RecordingServiceDeps {
  storageRoot: string;
  workspaceId: string;
  maxFileSizeBytes: number;
  maxFilesPerUpload: number;
  enqueuePreparation: (recordingId: string) => Promise<void>;
  enqueueTranscription: (recordingId: string) => Promise<void>;
  enqueueAnalysis: (recordingId: string) => Promise<void>;
  now?: () => Date;
}

export interface UploadInput {
  tempPath: string;
  originalFilename: string;
  sizeBytes: number;
  languageHint?: SttLanguageHint;
}

export type RecordingListQuery = z.infer<typeof recordingListQuerySchema>;

export interface RecordingService {
  processUpload(input: UploadInput): Promise<UploadFileResult>;
  list(query: RecordingListQuery): Promise<RecordingListResponse>;
  getById(id: string): Promise<RecordingDto>;
  retry(id: string): Promise<RecordingDto>;
  config(): RecordingConfig;
}

type RecordingDocLike = RecordingRecord & { _id: { toString(): string } };
type AnalysisDocLike = ConversationAnalysisRecord & {
  _id: { toString(): string };
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toMetadataDto(
  metadata: RecordingMetadata | null | undefined,
): RecordingDto["metadata"] {
  if (!metadata) {
    return null;
  }

  return {
    ...(metadata.format ? { format: metadata.format } : {}),
    ...(metadata.codec ? { codec: metadata.codec } : {}),
    ...(typeof metadata.sampleRate === "number"
      ? { sampleRate: metadata.sampleRate }
      : {}),
    ...(typeof metadata.channels === "number"
      ? { channels: metadata.channels }
      : {}),
    ...(typeof metadata.bitRate === "number"
      ? { bitRate: metadata.bitRate }
      : {}),
  };
}

function toErrorDto(
  error: RecordingError | null | undefined,
): RecordingDto["error"] {
  if (!error) {
    return null;
  }

  return {
    ...(error.code ? { code: error.code } : {}),
    message: error.message,
    ...(error.occurredAt
      ? { occurredAt: toIsoString(error.occurredAt) }
      : {}),
  };
}

export function toAnalysisDto(analysis: AnalysisDocLike): AnalysisDto {
  return {
    id: analysis._id.toString(),
    recordingId: analysis.recordingId,
    transcriptId: analysis.transcriptId,
    status: analysis.status,
    provider: analysis.provider,
    model: analysis.model,
    fallbackUsed: analysis.fallbackUsed ?? false,
    attemptedModels: analysis.attemptedModels ?? [],
    schemaVersion: analysis.schemaVersion,
    promptVersion: analysis.promptVersion,
    summary: analysis.summary ?? null,
    topics: analysis.topics ?? [],
    insights: analysis.insights ?? [],
    error: toErrorDto(analysis.error),
    analyzedAt: analysis.analyzedAt
      ? toIsoString(analysis.analyzedAt)
      : null,
    attempts: analysis.attempts ?? 0,
    createdAt: toIsoString(analysis.createdAt),
    updatedAt: toIsoString(analysis.updatedAt),
  };
}

function toTranscriptDto(
  transcript: RecordingRecord["transcript"],
  recordingId: string,
): TranscriptDto | null {
  if (!transcript) {
    return null;
  }

  return {
    ...transcript,
    id: transcript.id ?? `tx-${recordingId}`,
    segments: transcript.segments.map((segment, index) => ({
      ...segment,
      id: segment.id ?? `seg-${recordingId}-${index}`,
    })),
  };
}

export function toRecordingDto(
  recording: RecordingDocLike,
  analysis: AnalysisDocLike | null = null,
): RecordingDto {
  return {
    id: recording._id.toString(),
    originalFilename: recording.originalFilename,
    mimeType: recording.detectedMimeType,
    extension: recording.extension,
    sizeBytes: recording.sizeBytes,
    checksum: recording.checksum,
    status: recording.status,
    languageHint: recording.languageHint ?? DEFAULT_STT_LANGUAGE_HINT,
    progress: recording.progress ?? 0,
    durationSeconds: recording.durationSeconds ?? null,
    metadata: toMetadataDto(recording.metadata),
    error: toErrorDto(recording.error),
    attempts: recording.attempts ?? 0,
    transcriptionAttempts: recording.transcriptionAttempts ?? 0,
    createdAt: toIsoString(recording.createdAt),
    updatedAt: toIsoString(recording.updatedAt),
    preparedAt: recording.preparedAt
      ? toIsoString(recording.preparedAt)
      : null,
    transcript: toTranscriptDto(recording.transcript, recording._id.toString()),
    analysis: analysis ? toAnalysisDto(analysis) : null,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

async function findAnalysis(
  recordingId: string,
  workspaceId: string,
): Promise<AnalysisDocLike | null> {
  const analysis = await AnalysisModel.findOne({
    recordingId,
    workspaceId,
  }).lean();
  return analysis as unknown as AnalysisDocLike | null;
}

async function duplicateResult(
  originalFilename: string,
  existing: RecordingDocLike,
  workspaceId: string,
): Promise<UploadFileResult> {
  const analysis = await findAnalysis(existing._id.toString(), workspaceId);
  return {
    originalFilename,
    status: "duplicate",
    recording: toRecordingDto(existing, analysis),
    duplicateOf: existing._id.toString(),
    error: null,
  };
}

type QueueStage = "preparation" | "transcription" | "analysis";

function queueError(stage: QueueStage): RecordingError {
  const errors: Record<QueueStage, RecordingError> = {
    preparation: {
      code: "PREPARATION_QUEUE_UNAVAILABLE",
      message:
        "The recording was saved but could not be queued for preparation. Please retry.",
      occurredAt: new Date(),
    },
    transcription: {
      code: "TRANSCRIPTION_QUEUE_UNAVAILABLE",
      message:
        "The recording was prepared but could not be queued for transcription. Please retry.",
      occurredAt: new Date(),
    },
    analysis: {
      code: "ANALYSIS_QUEUE_UNAVAILABLE",
      message:
        "The transcript was stored but could not be queued for analysis. Please retry.",
      occurredAt: new Date(),
    },
  };
  return errors[stage];
}

export function createRecordingService(
  deps: RecordingServiceDeps,
): RecordingService {
  const now = deps.now ?? (() => new Date());

  async function markFailedAfterQueueError(
    recordingId: string,
    stage: QueueStage,
  ): Promise<void> {
    const failureStatus: RecordingStatus =
      stage === "analysis" ? "analysis_failed" : "failed";
    await Recording.updateOne(
      { _id: recordingId },
      {
        $set: {
          status: failureStatus,
          progress: stage === "analysis" ? 90 : 0,
          error: queueError(stage),
        },
      },
    );
  }

  async function enqueue(recordingId: string): Promise<void> {
    await deps.enqueuePreparation(recordingId);
    await Recording.updateOne(
      { _id: recordingId },
      {
        $set: {
          status: "queued" satisfies RecordingStatus,
          progress: 5,
          queuedAt: now(),
          error: null,
        },
      },
    );
  }

  return {
    async processUpload(input: UploadInput): Promise<UploadFileResult> {
      let tempPath: string | null = input.tempPath;

      try {
        const validated = await validateAudioFile({
          filePath: input.tempPath,
          originalFilename: input.originalFilename,
          maxSizeBytes: deps.maxFileSizeBytes,
        });
        const checksum = await computeSha256(input.tempPath);

        const existing = await Recording.findOne({
          workspaceId: deps.workspaceId,
          checksum,
        }).lean();

        if (existing) {
          return await duplicateResult(
            input.originalFilename,
            existing as unknown as RecordingDocLike,
            deps.workspaceId,
          );
        }

        const storageKey = buildStorageKey(
          deps.workspaceId,
          validated.extension,
          now(),
        );
        await moveIntoStorage(input.tempPath, deps.storageRoot, storageKey);
        tempPath = null;

        let created: RecordingDocument;
        try {
          created = await Recording.create({
            workspaceId: deps.workspaceId,
            originalFilename: input.originalFilename,
            storageKey,
            extension: validated.extension,
            detectedMimeType: validated.detectedMimeType,
            sizeBytes: validated.sizeBytes,
            checksum,
            status: "uploaded",
            languageHint: input.languageHint ?? DEFAULT_STT_LANGUAGE_HINT,
            progress: 0,
            metadata: null,
            error: null,
          });
        } catch (error) {
          if (isDuplicateKeyError(error)) {
            await removeFileIfExists(
              resolveStoragePath(deps.storageRoot, storageKey),
            );
            const concurrent = await Recording.findOne({
              workspaceId: deps.workspaceId,
              checksum,
            }).lean();
            if (concurrent) {
              return await duplicateResult(
                input.originalFilename,
                concurrent as unknown as RecordingDocLike,
                deps.workspaceId,
              );
            }
          }

          await removeFileIfExists(
            resolveStoragePath(deps.storageRoot, storageKey),
          );
          throw error;
        }

        try {
          await enqueue(String(created._id));
        } catch {
          await markFailedAfterQueueError(String(created._id), "preparation");
        }

        const fresh = await Recording.findById(created._id).lean();
        if (!fresh) {
          throw new ApiError(
            500,
            "RECORDING_NOT_PERSISTED",
            "The recording was stored but could not be read back.",
          );
        }

        return {
          originalFilename: input.originalFilename,
          status: "created",
          recording: toRecordingDto(fresh as unknown as RecordingDocLike),
          duplicateOf: null,
          error: null,
        };
      } finally {
        if (tempPath) {
          await removeFileIfExists(tempPath);
        }
      }
    },

    async list(query: RecordingListQuery): Promise<RecordingListResponse> {
      const filter: FilterQuery<RecordingRecord> = {
        workspaceId: deps.workspaceId,
      };

      if (query.status) {
        filter.status = query.status;
      }

      const skip = (query.page - 1) * query.limit;
      const [items, total] = await Promise.all([
        Recording.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(query.limit)
          .lean(),
        Recording.countDocuments(filter),
      ]);

      const recordingIds = items.map((item) => String(item._id));
      const analyses = recordingIds.length
        ? await AnalysisModel.find({
            workspaceId: deps.workspaceId,
            recordingId: { $in: recordingIds },
          }).lean()
        : [];
      const analysisByRecording = new Map(
        (analyses as unknown as AnalysisDocLike[]).map((analysis) => [
          analysis.recordingId,
          analysis,
        ]),
      );

      return {
        items: items.map((item) => {
          const id = String(item._id);
          return toRecordingDto(
            item as unknown as RecordingDocLike,
            analysisByRecording.get(id) ?? null,
          );
        }),
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      };
    },

    async getById(id: string): Promise<RecordingDto> {
      if (!isValidObjectId(id)) {
        throw new ApiError(
          400,
          "INVALID_RECORDING_ID",
          "The recording id is not valid.",
        );
      }

      const recording = await Recording.findOne({
        _id: id,
        workspaceId: deps.workspaceId,
      }).lean();

      if (!recording) {
        throw new ApiError(
          404,
          "RECORDING_NOT_FOUND",
          "Recording not found.",
        );
      }

      const analysis = await findAnalysis(id, deps.workspaceId);
      return toRecordingDto(
        recording as unknown as RecordingDocLike,
        analysis,
      );
    },

    async retry(id: string): Promise<RecordingDto> {
      if (!isValidObjectId(id)) {
        throw new ApiError(
          400,
          "INVALID_RECORDING_ID",
          "The recording id is not valid.",
        );
      }

      const existing = await Recording.findOne({
        _id: id,
        workspaceId: deps.workspaceId,
      }).lean();

      if (!existing) {
        throw new ApiError(
          404,
          "RECORDING_NOT_FOUND",
          "Recording not found.",
        );
      }

      if (
        existing.status === "queued" ||
        existing.status === "processing" ||
        existing.status === "transcription_queued" ||
        existing.status === "transcribing" ||
        existing.status === "analysis_queued" ||
        existing.status === "analyzing"
      ) {
        throw new ApiError(
          409,
          "RETRY_CONFLICT",
          "The recording is already queued or being processed.",
        );
      }

      if (existing.status !== "failed" && existing.status !== "analysis_failed") {
        throw new ApiError(
          409,
          "RETRY_CONFLICT",
          `Only failed recordings can be retried (current status: ${existing.status}).`,
        );
      }

      const currentStatus = existing.status;
      const stage: QueueStage =
        currentStatus === "analysis_failed"
          ? "analysis"
          : existing.preparedAt === null || existing.preparedAt === undefined
            ? "preparation"
            : "transcription";
      const nextStatus: RecordingStatus =
        stage === "preparation"
          ? "queued"
          : stage === "transcription"
            ? "transcription_queued"
            : "analysis_queued";
      const enqueueStage =
        stage === "preparation"
          ? deps.enqueuePreparation
          : stage === "transcription"
            ? deps.enqueueTranscription
            : deps.enqueueAnalysis;

      const updated = await Recording.findOneAndUpdate(
        { _id: id, workspaceId: deps.workspaceId, status: currentStatus },
        {
          $set: {
            status: nextStatus,
            progress:
              stage === "preparation" ? 5 : stage === "transcription" ? 60 : 90,
            queuedAt: now(),
            error: null,
          },
        },
        { new: true },
      ).lean();

      if (!updated) {
        throw new ApiError(
          409,
          "RETRY_CONFLICT",
          "The recording could not be retried because its status changed.",
        );
      }

      try {
        await enqueueStage(id);
      } catch {
        await markFailedAfterQueueError(id, stage);
        throw new ApiError(
          503,
          "QUEUE_UNAVAILABLE",
          stage === "preparation"
            ? "The preparation queue is unavailable. Please retry shortly."
            : stage === "transcription"
              ? "The transcription queue is unavailable. Please retry shortly."
              : "The analysis queue is unavailable. Please retry shortly.",
        );
      }

      const analysis = await findAnalysis(id, deps.workspaceId);
      return toRecordingDto(
        updated as unknown as RecordingDocLike,
        analysis,
      );
    },

    config(): RecordingConfig {
      return {
        maxFileSizeBytes: deps.maxFileSizeBytes,
        maxFilesPerUpload: deps.maxFilesPerUpload,
        supportedExtensions: [...SUPPORTED_AUDIO_EXTENSIONS],
        supportedLanguageHints: [...STT_LANGUAGE_HINTS],
      };
    },
  };
}
