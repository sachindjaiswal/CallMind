import { loadEnv } from "./config/env";
import { createApp } from "./app";
import { connectMongo, disconnectMongo, pingMongo } from "./lib/mongo";
import { createRedis, pingRedis } from "./lib/redis";
import { createLogger } from "./lib/logger";
import { createDailyReportQueue } from "./lib/dailyReportQueue";
import { createRecordingQueue } from "./lib/recordingQueue";
import { initStorage } from "./lib/storage";
import { createDailyReportsRouter } from "./routes/dailyReports";
import { createRecordingsRouter } from "./routes/recordings";
import { createDailyReportService } from "./services/dailyReportService";
import { createRecordingService } from "./services/recordingService";
import { checkHealth } from "./services/health";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger("callmind-api", env.LOG_LEVEL);
  const redis = createRedis(env.REDIS_URL, logger);
  const queueRedis = createRedis(env.REDIS_URL, logger);

  await connectMongo(env.MONGODB_URI, logger);

  const storage = await initStorage(env.STORAGE_DIR);
  logger.info({ storageRoot: storage.root }, "Recording storage ready");

  const recordingQueue = createRecordingQueue(queueRedis, logger);
  const dailyReportRedis = createRedis(env.REDIS_URL, logger);
  const dailyReportQueue = createDailyReportQueue(dailyReportRedis);

  const recordingService = createRecordingService({
    storageRoot: storage.root,
    workspaceId: env.WORKSPACE_ID,
    maxFileSizeBytes: env.MAX_UPLOAD_BYTES,
    maxFilesPerUpload: env.MAX_FILES_PER_UPLOAD,
    enqueuePreparation: (recordingId) =>
      recordingQueue.enqueuePreparation(recordingId),
    enqueueTranscription: (recordingId) =>
      recordingQueue.enqueueTranscription(recordingId),
    enqueueAnalysis: (recordingId) =>
      recordingQueue.enqueueAnalysis(recordingId),
  });

  const dailyReportService = createDailyReportService({
    workspaceId: env.WORKSPACE_ID,
    enqueueReport: (reportId) => dailyReportQueue.enqueueReport(reportId),
  });

  const corsOrigins = env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const app = createApp({
    logger,
    corsOrigins,
    recordingsRouter: createRecordingsRouter({
      service: recordingService,
      tempDir: storage.tempDir,
      maxFileSizeBytes: env.MAX_UPLOAD_BYTES,
      maxFilesPerUpload: env.MAX_FILES_PER_UPLOAD,
      logger,
    }),
    dailyReportsRouter: createDailyReportsRouter({
      service: dailyReportService,
    }),
    getHealth: () =>
      checkHealth({
        pingMongo,
        pingRedis: () => pingRedis(redis),
      }),
  });

  const server = app.listen(env.PORT, "0.0.0.0", () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `CallMind API listening on http://0.0.0.0:${env.PORT}`,
    );
  });

  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "Shutting down API");

    const forceExit = setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(() => {
      void (async () => {
        try {
          await recordingQueue.close();
          await dailyReportQueue.close();
          await queueRedis.quit();
          await dailyReportRedis.quit();
          await redis.quit();
          await disconnectMongo();
          logger.info("API shutdown complete");
          process.exit(0);
        } catch (error) {
          logger.error({ err: error }, "Error during shutdown");
          process.exit(1);
        }
      })();
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection", reason);
});

main().catch((error: unknown) => {
  console.error("Failed to start CallMind API", error);
  process.exit(1);
});
