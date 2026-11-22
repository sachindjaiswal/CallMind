import {
  ANALYSIS_JOB_ATTEMPTS,
  ANALYSIS_PROMPT_VERSION,
  ANALYSIS_SCHEMA_VERSION,
  QUEUES,
  type RecordingAnalyzeJobData,
  type RecordingAnalyzeJobResult,
  type TranscriptDto,
} from "@callmind/shared";
import {
  ConversationAnalysis as AnalysisModel,
  Recording,
  type RecordingRecord,
} from "@callmind/db";
import { UnrecoverableError, type Job } from "bullmq";
import { isValidObjectId } from "mongoose";
import {
  AnalysisValidationError,
  type ConversationAnalysisResult,
} from "../lib/conversationAnalysis";
import { GeminiAnalysisError } from "../lib/geminiAnalysis";
import { RecordingProcessingError } from "./recordingPrepare";

export const RECORDING_ANALYZE_QUEUE_NAME = QUEUES.RECORDING_ANALYZE;

export interface RecordingAnalyzeDeps {
  analyze: (input: {
    recordingId: string;
    transcript: TranscriptDto;
  }) => Promise<ConversationAnalysisResult>;
}

function toTranscriptDto(
  recordingId: string,
  transcript: NonNullable<RecordingRecord["transcript"]>,
): TranscriptDto {
  return {
    ...transcript,
    id: transcript.id ?? `tx-${recordingId}`,
    segments: transcript.segments.map((segment, index) => ({
      ...segment,
      id: segment.id ?? `seg-${recordingId}-${index}`,
    })),
  };
}

type RecordingDocLike = RecordingRecord & { _id: { toString(): string } };

export type RecordingAnalyzeJob = Job<
  RecordingAnalyzeJobData,
  RecordingAnalyzeJobResult
>;

const CLAIMABLE_STATUSES: RecordingRecord["status"][] = [
  "analysis_queued",
  "analysis_failed",
];

function errorDetails(error: unknown): {
  code: string;
  message: string;
  retryable: boolean;
} {
  if (error instanceof GeminiAnalysisError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
  }

  if (error instanceof AnalysisValidationError) {
    return { code: error.code, message: error.message, retryable: false };
  }

  if (error instanceof RecordingProcessingError) {
    return { code: error.code, message: error.message, retryable: false };
  }

  return {
    code: "ANALYSIS_FAILED",
    message: error instanceof Error ? error.message : "Unknown analysis error.",
    retryable: true,
  };
}

export function createRecordingAnalyzeProcessor(
  deps: RecordingAnalyzeDeps,
): (job: RecordingAnalyzeJob) => Promise<RecordingAnalyzeJobResult> {
  return async (job) => {
    const recordingId = job.data?.recordingId;

    if (!recordingId || !isValidObjectId(recordingId)) {
      throw new UnrecoverableError("Invalid recording id.");
    }

    const recording = (await Recording.findById(recordingId).lean()) as
      | RecordingDocLike
      | null;

    if (!recording) {
      throw new UnrecoverableError("Recording not found.");
    }

    if (!recording.transcript) {
      throw new UnrecoverableError("Recording has no transcript to analyse.");
    }

    const transcriptId = recording.transcript.id ?? recordingId;
    const existing = await AnalysisModel.findOne({ recordingId }).lean();

    if (existing?.status === "completed" && existing.transcriptId === transcriptId) {
      if (recording.status !== "analysis_completed") {
        await Recording.updateOne(
          { _id: recordingId },
          {
            $set: {
              status: "analysis_completed",
              progress: 100,
              error: null,
            },
          },
        );
      }
      return {
        ok: true,
        recordingId,
        skipped: true,
        analysisId: existing._id.toString(),
        model: existing.model,
        fallbackUsed: existing.fallbackUsed,
      };
    }

    if (!CLAIMABLE_STATUSES.includes(recording.status)) {
      return { ok: true, recordingId, skipped: true };
    }

    const claimed = (await Recording.findOneAndUpdate(
      { _id: recordingId, status: { $in: CLAIMABLE_STATUSES } },
      {
        $set: {
          status: "analyzing",
          progress: 95,
          error: null,
        },
      },
      { new: true },
    ).lean()) as RecordingDocLike | null;

    if (!claimed) {
      return { ok: true, recordingId, skipped: true };
    }

    await AnalysisModel.findOneAndUpdate(
      { recordingId, workspaceId: claimed.workspaceId },
      {
        $set: {
          transcriptId,
          status: "analyzing",
          provider: "gemini",
          model: "",
          schemaVersion: ANALYSIS_SCHEMA_VERSION,
          promptVersion: ANALYSIS_PROMPT_VERSION,
          error: null,
        },
        $setOnInsert: {
          recordingId,
          attemptedModels: [],
          fallbackUsed: false,
          summary: null,
          topics: [],
          insights: [],
          analyzedAt: null,
        },
        $inc: { attempts: 1 },
      },
      { upsert: true, new: true },
    );

    try {
      const result = await deps.analyze({
        recordingId,
        transcript: toTranscriptDto(
          recordingId,
          claimed.transcript as NonNullable<RecordingRecord["transcript"]>,
        ),
      });

      const analysis = await AnalysisModel.findOneAndUpdate(
        { recordingId, workspaceId: claimed.workspaceId },
        {
          $set: {
            transcriptId,
            status: "completed",
            provider: result.provider,
            model: result.model,
            fallbackUsed: result.fallbackUsed,
            attemptedModels: result.attemptedModels,
            schemaVersion: result.schemaVersion,
            promptVersion: result.promptVersion,
            summary: result.summary,
            topics: result.topics,
            insights: result.insights,
            analyzedAt: new Date(),
            error: null,
          },
        },
        { new: true },
      );

      await Recording.updateOne(
        { _id: recordingId },
        {
          $set: {
            status: "analysis_completed",
            progress: 100,
            error: null,
          },
        },
      );

      return {
        ok: true,
        recordingId,
        analysisId: analysis?._id.toString(),
        model: result.model,
        fallbackUsed: result.fallbackUsed,
      };
    } catch (error) {
      const details = errorDetails(error);
      const finalAttempt =
        !details.retryable || job.attemptsMade + 1 >= (job.opts.attempts ?? ANALYSIS_JOB_ATTEMPTS);
      const analysisStatus = finalAttempt ? "failed" : "queued";

      await AnalysisModel.updateOne(
        { recordingId, workspaceId: claimed.workspaceId },
        {
          $set: {
            status: analysisStatus,
            error: {
              code: details.code,
              message: details.message,
              occurredAt: new Date(),
            },
          },
        },
      );

      await Recording.updateOne(
        { _id: recordingId },
        {
          $set: {
            status: finalAttempt ? "analysis_failed" : "analysis_queued",
            error: {
              code: details.code,
              message: details.message,
              occurredAt: new Date(),
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
