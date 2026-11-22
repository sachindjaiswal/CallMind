import {
  ANALYSIS_JOB_ATTEMPTS,
  ANALYSIS_JOB_BACKOFF_MS,
  QUEUES,
  RECORDING_JOB_ATTEMPTS,
  RECORDING_JOB_BACKOFF_MS,
  TRANSCRIPTION_JOB_ATTEMPTS,
  TRANSCRIPTION_JOB_BACKOFF_MS,
  type RecordingAnalyzeJobData,
  type RecordingPrepareJobData,
  type RecordingTranscribeJobData,
} from "@callmind/shared";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "pino";

export interface RecordingQueue {
  enqueuePreparation(recordingId: string): Promise<void>;
  enqueueTranscription(recordingId: string): Promise<void>;
  enqueueAnalysis(recordingId: string): Promise<void>;
  close(): Promise<void>;
}

export function createRecordingQueue(
  connection: Redis,
  logger: Logger,
): RecordingQueue {
  const prepareQueue = new Queue<RecordingPrepareJobData>(
    QUEUES.RECORDING_PREPARE,
    { connection },
  );
  const transcribeQueue = new Queue<RecordingTranscribeJobData>(
    QUEUES.RECORDING_TRANSCRIBE,
    { connection },
  );
  const analyzeQueue = new Queue<RecordingAnalyzeJobData>(
    QUEUES.RECORDING_ANALYZE,
    { connection },
  );

  async function replaceJob(
    queue:
      | Queue<RecordingPrepareJobData>
      | Queue<RecordingTranscribeJobData>
      | Queue<RecordingAnalyzeJobData>,
    queueName: string,
    recordingId: string,
    name: string,
    options: {
      attempts: number;
      backoffMs: number;
    },
  ): Promise<void> {
    try {
      await queue.remove(recordingId);
    } catch (error) {
      logger.warn(
        { err: error, recordingId, queue: queueName },
        "Could not remove previous job; adding anyway",
      );
    }

    await queue.add(
      name,
      { recordingId },
      {
        jobId: recordingId,
        attempts: options.attempts,
        backoff: {
          type: "exponential",
          delay: options.backoffMs,
        },
        removeOnComplete: 500,
        removeOnFail: 1_000,
      },
    );
  }

  return {
    async enqueuePreparation(recordingId: string): Promise<void> {
      await replaceJob(
        prepareQueue,
        QUEUES.RECORDING_PREPARE,
        recordingId,
        "prepare",
        {
          attempts: RECORDING_JOB_ATTEMPTS,
          backoffMs: RECORDING_JOB_BACKOFF_MS,
        },
      );
    },

    async enqueueTranscription(recordingId: string): Promise<void> {
      await replaceJob(
        transcribeQueue,
        QUEUES.RECORDING_TRANSCRIBE,
        recordingId,
        "transcribe",
        {
          attempts: TRANSCRIPTION_JOB_ATTEMPTS,
          backoffMs: TRANSCRIPTION_JOB_BACKOFF_MS,
        },
      );
    },

    async enqueueAnalysis(recordingId: string): Promise<void> {
      await replaceJob(
        analyzeQueue,
        QUEUES.RECORDING_ANALYZE,
        recordingId,
        "analyze",
        {
          attempts: ANALYSIS_JOB_ATTEMPTS,
          backoffMs: ANALYSIS_JOB_BACKOFF_MS,
        },
      );
    },

    async close(): Promise<void> {
      await Promise.all([
        prepareQueue.close(),
        transcribeQueue.close(),
        analyzeQueue.close(),
      ]);
    },
  };
}
