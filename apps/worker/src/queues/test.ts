import type { Job } from "bullmq";
import {
  QUEUES,
  type TestJobData,
  type TestJobResult,
} from "@callmind/shared";

export const TEST_QUEUE_NAME = QUEUES.TEST;

export function processTestJobData(data: TestJobData): TestJobResult {
  return {
    ok: true,
    message: data.message,
    processedAt: new Date().toISOString(),
  };
}

export async function processTestJob(
  job: Job<TestJobData, TestJobResult>,
): Promise<TestJobResult> {
  return processTestJobData(job.data);
}
