import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve, sep } from "node:path";
import {
  QUEUES,
  type RecordingPrepareJobData,
  type RecordingPrepareJobResult,
} from "@callmind/shared";
import {
  Recording,
  type RecordingMetadata,
  type RecordingRecord,
} from "@callmind/db";
import { UnrecoverableError, type Job } from "bullmq";
import { isValidObjectId } from "mongoose";

export const RECORDING_PREPARE_QUEUE_NAME = QUEUES.RECORDING_PREPARE;

export class RecordingProcessingError extends Error {
  readonly code: string;

  constructor(message: string, code = "PREPARATION_FAILED") {
    super(message);
    this.name = "RecordingProcessingError";
    this.code = code;
  }
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  sample_rate?: string;
  channels?: number;
  duration?: string;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: {
    format_name?: string;
    duration?: string;
    bit_rate?: string;
  };
}

export interface ProbeResult {
  durationSeconds: number;
  metadata: RecordingMetadata;
}

function runFfprobe(ffprobePath: string, filePath: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile(
      ffprobePath,
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filePath,
      ],
      { timeout: 30_000, maxBuffer: 5 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const detail = stderr.trim() || error.message;
          reject(
            new RecordingProcessingError(
              `ffprobe failed: ${detail}`,
              "FFPROBE_FAILED",
            ),
          );
          return;
        }

        resolvePromise(stdout.toString());
      },
    );
  });
}

export async function probeAudio(
  filePath: string,
  ffprobePath = "ffprobe",
): Promise<ProbeResult> {
  const stdout = await runFfprobe(ffprobePath, filePath);

  let parsed: FfprobeOutput;
  try {
    parsed = JSON.parse(stdout) as FfprobeOutput;
  } catch {
    throw new RecordingProcessingError(
      "ffprobe returned invalid JSON.",
      "FFPROBE_INVALID_OUTPUT",
    );
  }

  const audioStream = parsed.streams?.find(
    (stream) => stream.codec_type === "audio",
  );

  if (!audioStream) {
    throw new RecordingProcessingError(
      "No audio stream was found in the file.",
      "NO_AUDIO_STREAM",
    );
  }

  const duration = Number(parsed.format?.duration ?? audioStream.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new RecordingProcessingError(
      "The audio duration could not be determined.",
      "INVALID_DURATION",
    );
  }

  const sampleRate = Number.parseInt(audioStream.sample_rate ?? "", 10);
  const bitRate = Number.parseInt(parsed.format?.bit_rate ?? "", 10);

  return {
    durationSeconds: Math.round(duration * 1000) / 1000,
    metadata: {
      ...(parsed.format?.format_name
        ? { format: parsed.format.format_name }
        : {}),
      ...(audioStream.codec_name ? { codec: audioStream.codec_name } : {}),
      ...(Number.isFinite(sampleRate) ? { sampleRate } : {}),
      ...(typeof audioStream.channels === "number"
        ? { channels: audioStream.channels }
        : {}),
      ...(Number.isFinite(bitRate) ? { bitRate } : {}),
    },
  };
}

export function resolveRecordingPath(
  storageRoot: string,
  storageKey: string,
): string {
  const root = resolve(storageRoot);
  const fullPath = resolve(root, storageKey);

  if (fullPath !== root && !fullPath.startsWith(root + sep)) {
    throw new RecordingProcessingError(
      "The recording storage key is invalid.",
      "INVALID_STORAGE_KEY",
    );
  }

  return fullPath;
}

export interface RecordingPrepareDeps {
  storageRoot: string;
  ffprobePath: string;
  enqueueTranscription: (recordingId: string) => Promise<void>;
}

type RecordingDocLike = RecordingRecord & { _id: { toString(): string } };

export type RecordingPrepareJob = Job<
  RecordingPrepareJobData,
  RecordingPrepareJobResult
>;

export function createRecordingPrepareProcessor(
  deps: RecordingPrepareDeps,
): (job: RecordingPrepareJob) => Promise<RecordingPrepareJobResult> {
  return async (job) => {
    const recordingId = job.data?.recordingId;

    if (!recordingId || !isValidObjectId(recordingId)) {
      throw new UnrecoverableError("Invalid recording id.");
    }

    const recording = (await Recording.findById(recordingId).lean()) as
      | (RecordingDocLike & { status: RecordingRecord["status"] })
      | null;

    if (!recording) {
      throw new UnrecoverableError("Recording not found.");
    }

    if (
      recording.status === "transcribed" ||
      recording.status === "transcription_queued" ||
      recording.status === "transcribing"
    ) {
      return {
        ok: true,
        recordingId,
        skipped: true,
        durationSeconds: recording.durationSeconds,
      };
    }

    if (recording.status === "ready_for_transcription") {
      try {
        await deps.enqueueTranscription(recordingId);
      } catch (error) {
        await Recording.updateOne(
          { _id: recordingId },
          {
            $set: {
              status: "failed",
              error: {
                code: "TRANSCRIPTION_QUEUE_UNAVAILABLE",
                message:
                  "The recording was prepared but could not be queued for transcription.",
                occurredAt: new Date(),
              },
            },
          },
        );
        throw error;
      }

      return {
        ok: true,
        recordingId,
        skipped: true,
        durationSeconds: recording.durationSeconds,
      };
    }

    const claimed = (await Recording.findOneAndUpdate(
      {
        _id: recordingId,
        status: { $ne: "ready_for_transcription" },
      },
      {
        $set: {
          status: "processing",
          processingStartedAt: new Date(),
          progress: 10,
          error: null,
        },
        $inc: { attempts: 1 },
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

      const probe = await probeAudio(absolutePath, deps.ffprobePath);

      await Recording.updateOne(
        { _id: recordingId },
        {
          $set: {
            status: "ready_for_transcription",
            progress: 100,
            durationSeconds: probe.durationSeconds,
            metadata: probe.metadata,
            preparedAt: new Date(),
            error: null,
          },
        },
      );

      try {
        await deps.enqueueTranscription(recordingId);
      } catch {
        throw new RecordingProcessingError(
          "The recording was prepared but could not be queued for transcription.",
          "TRANSCRIPTION_QUEUE_UNAVAILABLE",
        );
      }

      return {
        ok: true,
        recordingId,
        durationSeconds: probe.durationSeconds,
      };
    } catch (error) {
      const attempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= attempts;
      const code =
        error instanceof RecordingProcessingError
          ? error.code
          : "PREPARATION_FAILED";
      const message =
        error instanceof Error ? error.message : "Unknown preparation error.";

      await Recording.updateOne(
        { _id: recordingId },
        {
          $set: {
            status: isFinalAttempt ? "failed" : "queued",
            progress: 0,
            error: {
              code,
              message,
              occurredAt: new Date(),
            },
          },
        },
      );

      throw error instanceof Error ? error : new Error(message);
    }
  };
}
