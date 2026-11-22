import {
  ANALYSIS_JOB_ATTEMPTS,
  ANALYSIS_JOB_BACKOFF_MS,
  QUEUES,
  TRANSCRIPTION_JOB_ATTEMPTS,
  TRANSCRIPTION_JOB_BACKOFF_MS,
  type RecordingAnalyzeJobData,
  type RecordingTranscribeJobData,
} from "@callmind/shared";
import { Queue, Worker } from "bullmq";
import { loadWorkerEnv } from "./config/env";
import { connectMongo, disconnectMongo } from "./lib/mongo";
import { createLogger } from "./lib/logger";
import { createRedis } from "./lib/redis";
import { analyzeConversationWithGemini } from "./lib/conversationAnalysis";
import { createSttTranscriber } from "./lib/stt";
import { TEST_QUEUE_NAME, processTestJob } from "./queues/test";
import {
  RECORDING_PREPARE_QUEUE_NAME,
  createRecordingPrepareProcessor,
} from "./queues/recordingPrepare";
import {
  RECORDING_TRANSCRIBE_QUEUE_NAME,
  createRecordingTranscribeProcessor,
} from "./queues/recordingTranscribe";
import {
  RECORDING_ANALYZE_QUEUE_NAME,
  createRecordingAnalyzeProcessor,
} from "./queues/recordingAnalyze";
import {
  DAILY_REPORT_QUEUE_NAME,
  createDailyReportProcessor,
} from "./queues/dailyReport";

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const logger = createLogger("callmind-worker", env.LOG_LEVEL);

  await connectMongo(env.MONGODB_URI, logger);

  const testConnection = createRedis(env.REDIS_URL, logger);
  const prepareConnection = createRedis(env.REDIS_URL, logger);
  const transcriptionConnection = createRedis(env.REDIS_URL, logger);
  const transcriptionQueue = new Queue<RecordingTranscribeJobData>(
    QUEUES.RECORDING_TRANSCRIBE,
    { connection: transcriptionConnection },
  );
  const analysisConnection = createRedis(env.REDIS_URL, logger);
  const analysisQueue = new Queue<RecordingAnalyzeJobData>(
    QUEUES.RECORDING_ANALYZE,
    { connection: analysisConnection },
  );
  const dailyReportConnection = createRedis(env.REDIS_URL, logger);

  const transcriber = createSttTranscriber({
    strategy: env.STT_STRATEGY,
    groq: {
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_STT_MODEL,
      maxBytes: env.GROQ_STT_MAX_BYTES,
    },
    gemini: {
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_STT_MODEL,
      maxBytes: env.GEMINI_STT_MAX_BYTES,
      ffmpegPath: env.FFMPEG_PATH,
    },
  });

  const enqueueAnalysis = async (recordingId: string): Promise<void> => {
    try {
      await analysisQueue.remove(recordingId);
    } catch (error) {
      logger.warn(
        { err: error, recordingId, queue: QUEUES.RECORDING_ANALYZE },
        "Could not remove previous analysis job; adding anyway",
      );
    }

    await analysisQueue.add(
      "analyze",
      { recordingId },
      {
        jobId: recordingId,
        attempts: ANALYSIS_JOB_ATTEMPTS,
        backoff: {
          type: "exponential",
          delay: ANALYSIS_JOB_BACKOFF_MS,
        },
        removeOnComplete: 500,
        removeOnFail: 1_000,
      },
    );
  };

  const enqueueTranscription = async (recordingId: string): Promise<void> => {
    try {
      await transcriptionQueue.remove(recordingId);
    } catch (error) {
      logger.warn(
        { err: error, recordingId, queue: QUEUES.RECORDING_TRANSCRIBE },
        "Could not remove previous transcription job; adding anyway",
      );
    }

    await transcriptionQueue.add(
      "transcribe",
      { recordingId },
      {
        jobId: recordingId,
        attempts: TRANSCRIPTION_JOB_ATTEMPTS,
        backoff: {
          type: "exponential",
          delay: TRANSCRIPTION_JOB_BACKOFF_MS,
        },
        removeOnComplete: 500,
        removeOnFail: 1_000,
      },
    );
  };

  const testWorker = new Worker(TEST_QUEUE_NAME, processTestJob, {
    connection: testConnection,
    concurrency: 2,
  });

  const prepareWorker = new Worker(
    RECORDING_PREPARE_QUEUE_NAME,
    createRecordingPrepareProcessor({
      storageRoot: env.STORAGE_DIR,
      ffprobePath: env.FFPROBE_PATH,
      enqueueTranscription,
    }),
    {
      connection: prepareConnection,
      concurrency: 2,
    },
  );

  const transcribeWorker = new Worker(
    RECORDING_TRANSCRIBE_QUEUE_NAME,
    createRecordingTranscribeProcessor({
      storageRoot: env.STORAGE_DIR,
      transcriber,
      enqueueAnalysis,
    }),
    {
      connection: transcriptionConnection,
      concurrency: 2,
    },
  );

  const analyzeWorker = new Worker(
    RECORDING_ANALYZE_QUEUE_NAME,
    createRecordingAnalyzeProcessor({
      analyze: ({ recordingId, transcript }) =>
        analyzeConversationWithGemini({
          recordingId,
          transcript,
          adapterConfig: {
            apiKey: env.GEMINI_API_KEY,
            primaryModel: env.GEMINI_MODEL,
            fallbackModel: env.GEMINI_FALLBACK_MODEL,
          },
        }),
    }),
    {
      connection: analysisConnection,
      concurrency: 2,
    },
  );

  const dailyReportWorker = new Worker(
    DAILY_REPORT_QUEUE_NAME,
    createDailyReportProcessor(),
    {
      connection: dailyReportConnection,
      concurrency: 1,
    },
  );

  testWorker.on("ready", () => {
    logger.info(`Worker ready on queue "${TEST_QUEUE_NAME}"`);
  });

  testWorker.on("completed", (job, result) => {
    logger.info(
      { jobId: job.id, queue: TEST_QUEUE_NAME, result },
      "Job completed",
    );
  });

  testWorker.on("failed", (job, error) => {
    logger.error(
      { jobId: job?.id, queue: TEST_QUEUE_NAME, err: error },
      "Job failed",
    );
  });

  testWorker.on("error", (error) => {
    logger.error({ err: error, queue: TEST_QUEUE_NAME }, "Worker error");
  });

  prepareWorker.on("ready", () => {
    logger.info(`Worker ready on queue "${RECORDING_PREPARE_QUEUE_NAME}"`);
  });

  prepareWorker.on("completed", (job, result) => {
    logger.info(
      { jobId: job.id, queue: RECORDING_PREPARE_QUEUE_NAME, result },
      "Recording prepared",
    );
  });

  prepareWorker.on("failed", (job, error) => {
    logger.error(
      {
        jobId: job?.id,
        queue: RECORDING_PREPARE_QUEUE_NAME,
        attemptsMade: job?.attemptsMade,
        attempts: job?.opts.attempts,
        err: error,
      },
      "Recording preparation failed",
    );
  });

  prepareWorker.on("error", (error) => {
    logger.error(
      { err: error, queue: RECORDING_PREPARE_QUEUE_NAME },
      "Worker error",
    );
  });

  transcribeWorker.on("ready", () => {
    logger.info(`Worker ready on queue "${RECORDING_TRANSCRIBE_QUEUE_NAME}"`);
  });

  transcribeWorker.on("completed", (job, result) => {
    logger.info(
      { jobId: job.id, queue: RECORDING_TRANSCRIBE_QUEUE_NAME, result },
      "Recording transcribed",
    );
  });

  transcribeWorker.on("failed", (job, error) => {
    logger.error(
      {
        jobId: job?.id,
        queue: RECORDING_TRANSCRIBE_QUEUE_NAME,
        attemptsMade: job?.attemptsMade,
        attempts: job?.opts.attempts,
        err: error,
      },
      "Recording transcription failed",
    );
  });

  transcribeWorker.on("error", (error) => {
    logger.error(
      { err: error, queue: RECORDING_TRANSCRIBE_QUEUE_NAME },
      "Worker error",
    );
  });

  analyzeWorker.on("ready", () => {
    logger.info(`Worker ready on queue "${RECORDING_ANALYZE_QUEUE_NAME}"`);
  });

  analyzeWorker.on("completed", (job, result) => {
    logger.info(
      { jobId: job.id, queue: RECORDING_ANALYZE_QUEUE_NAME, result },
      "Recording analysed",
    );
  });

  analyzeWorker.on("failed", (job, error) => {
    logger.error(
      {
        jobId: job?.id,
        queue: RECORDING_ANALYZE_QUEUE_NAME,
        attemptsMade: job?.attemptsMade,
        attempts: job?.opts.attempts,
        err: error,
      },
      "Recording analysis failed",
    );
  });

  analyzeWorker.on("error", (error) => {
    logger.error(
      { err: error, queue: RECORDING_ANALYZE_QUEUE_NAME },
      "Worker error",
    );
  });

  dailyReportWorker.on("ready", () => {
    logger.info(`Worker ready on queue "${DAILY_REPORT_QUEUE_NAME}"`);
  });

  dailyReportWorker.on("completed", (job, result) => {
    logger.info(
      { jobId: job.id, queue: DAILY_REPORT_QUEUE_NAME, result },
      "Daily report generated",
    );
  });

  dailyReportWorker.on("failed", (job, error) => {
    logger.error(
      {
        jobId: job?.id,
        queue: DAILY_REPORT_QUEUE_NAME,
        attemptsMade: job?.attemptsMade,
        attempts: job?.opts.attempts,
        err: error,
      },
      "Daily report generation failed",
    );
  });

  dailyReportWorker.on("error", (error) => {
    logger.error({ err: error, queue: DAILY_REPORT_QUEUE_NAME }, "Worker error");
  });

  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "Shutting down worker");

    const forceExit = setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    void (async () => {
      try {
        await Promise.all([
          testWorker.close(),
          prepareWorker.close(),
          transcribeWorker.close(),
          analyzeWorker.close(),
          dailyReportWorker.close(),
          transcriptionQueue.close(),
          analysisQueue.close(),
        ]);
        await testConnection.quit();
        await prepareConnection.quit();
        await transcriptionConnection.quit();
        await analysisConnection.quit();
        await dailyReportConnection.quit();
        await disconnectMongo();
        logger.info("Worker shutdown complete");
        process.exit(0);
      } catch (error) {
        logger.error({ err: error }, "Error during worker shutdown");
        process.exit(1);
      }
    })();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection in worker", reason);
});

main().catch((error: unknown) => {
  console.error("Failed to start CallMind worker", error);
  process.exit(1);
});
