import { Queue } from "bullmq";
import { loadWorkerEnv } from "./config/env";
import { createLogger } from "./lib/logger";
import { createRedis } from "./lib/redis";
import { TEST_QUEUE_NAME } from "./queues/test";

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const logger = createLogger("callmind-worker-cli", env.LOG_LEVEL);
  const connection = createRedis(env.REDIS_URL, logger);
  const queue = new Queue(TEST_QUEUE_NAME, { connection });

  const job = await queue.add(
    "smoke-test",
    {
      message: "CallMind worker smoke test",
      requestedAt: new Date().toISOString(),
    },
    {
      removeOnComplete: 100,
      removeOnFail: 100,
      attempts: 2,
      backoff: { type: "exponential", delay: 1_000 },
    },
  );

  logger.info({ jobId: job.id, queue: TEST_QUEUE_NAME }, "Test job enqueued");

  await queue.close();
  await connection.quit();
}

main().catch((error: unknown) => {
  console.error("Failed to enqueue test job", error);
  process.exit(1);
});
