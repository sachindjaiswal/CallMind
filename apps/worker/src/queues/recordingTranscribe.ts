import { access } from "node:fs/promises";
import {
  QUEUES,
  DEFAULT_STT_LANGUAGE_HINT,
  type RecordingTranscribeJobData,
  type RecordingTranscribeJobResult,
  type SttLanguageHint,
  type TranscriptDto,
} from "@callmind/shared";
import { Recording, type RecordingRecord } from "@callmind/db";
import { UnrecoverableError, type Job } from "bullmq";
import { isValidObjectId } from "mongoose";
import { TranscriptionError } from "../lib/groqTranscription";
import {
  RecordingProcessingError,
  resolveRecordingPath,
} from "./recordingPrepare";

export const RECORDING_TRANSCRIBE_QUEUE_NAME = QUEUES.RECORDING_TRANSCRIBE;

export interface RecordingTranscribeDeps {
  storageRoot: string;
  transcriber: (
    filePath: string,
    recordingId: string,
    languageHint?: SttLanguageHint,
  ) => Promise<TranscriptDto>;
  enqueueAnalysis: (recordingId: string) => Promise<void>;
}

type RecordingDocLike = RecordingRecord & { _id: { toString(): string } };

export type RecordingTranscribeJob = Job<
  RecordingTranscribeJobData,
  RecordingTranscribeJobResult
>;

const CLAIMABLE_STATUSES: RecordingRecord["status"][] = [
  "ready_for_transcription",
  "transcription_queued",
];

const POST_TRANSCRIPTION_STATUSES: RecordingRecord["status"][] = [
  "transcribed",
  "analysis_queued",
  "analyzing",
  "analysis_completed",
  "analysis_failed",
];

function errorDetails(error: unknown): {
  code: string;
  message: string;
  retryable: boolean;
} {
  if (error instanceof TranscriptionError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
  }

  if (error instanceof RecordingProcessingError) {
    return {
      code: error.code,
      message: error.message,
      retryable: false,
    };
  }

  return {
    code: "TRANSCRIPTION_FAILED",
    message: error instanceof Error ? error.message : "Unknown transcription error.",
    retryable: true,
  };
}

export function createRecordingTranscribeProcessor(
  deps: RecordingTranscribeDeps,
): (job: RecordingTranscribeJob) => Promise<RecordingTranscribeJobResult> {
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

    if (
      POST_TRANSCRIPTION_STATUSES.includes(recording.status) ||
      (recording.status === "transcribing" && recording.transcript)
    ) {
      return { ok: true, recordingId, skipped: true };
    }

    if (!CLAIMABLE_STATUSES.includes(recording.status)) {
      return { ok: true, recordingId, skipped: true };
    }

    const claimed = (await Recording.findOneAndUpdate(
      { _id: recordingId, status: { $in: CLAIMABLE_STATUSES } },
      {
        $set: {
          status: "transcribing",
          processingStartedAt: new Date(),
          progress: 60,
          error: null,
        },
        $inc: { transcriptionAttempts: 1 },
      },
      { new: true },
    ).lean()) as RecordingDocLike | null;

    if (!claimed) {
      return { ok: true, recordingId, skipped: true };
    }

    try {
      const absolutePath = resolveRecordingPath(
        deps.storageRoot,
        claimed.storageKey,
      );

      try {
        await access(absolutePath);
      } catch {
        throw new RecordingProcessingError(
          "The stored audio file is missing.",
          "FILE_MISSING",
        );
      }

      const transcript = await deps.transcriber(
        absolutePath,
        recordingId,
        claimed.languageHint ?? DEFAULT_STT_LANGUAGE_HINT,
      );
      const durationSeconds =
        transcript.durationSeconds > 0
          ? transcript.durationSeconds
          : (claimed.durationSeconds ?? 0);

      await Recording.updateOne(
        { _id: recordingId },
        {
          $set: {
            status: "analysis_queued",
            progress: 90,
            durationSeconds,
            transcript,
            error: null,
          },
        },
      );

      try {
        await deps.enqueueAnalysis(recordingId);
      } catch (error) {
        await Recording.updateOne(
          { _id: recordingId },
          {
            $set: {
              status: "analysis_failed",
              error: {
                code: "ANALYSIS_QUEUE_UNAVAILABLE",
                message:
                  error instanceof Error
                    ? error.message
                    : "Could not queue conversation analysis.",
                occurredAt: new Date(),
              },
            },
          },
        );
      }

      return {
        ok: true,
        recordingId,
        language: transcript.language,
        durationSeconds,
      };
    } catch (error) {
      const details = errorDetails(error);
      const attempts = job.opts.attempts ?? 1;
      const finalAttempt =
        !details.retryable || job.attemptsMade + 1 >= attempts;

      await Recording.updateOne(
        { _id: recordingId },
        {
          $set: {
            status: finalAttempt ? "failed" : "transcription_queued",
            progress: 0,
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

      throw error instanceof Error
        ? error
        : new Error(details.message);
    }
  };
}
